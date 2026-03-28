import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OrderableExamItem } from "./SortableExamItem";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Save, AlertCircle } from "lucide-react";

export function ExamOrderView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const orgId = profile?.org_id;
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const [localItems, setLocalItems] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["test-categories", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("test_templates")
        .select("category")
        .or(`org_id.is.null,org_id.eq.${orgId}`);
      if (error) throw error;
      const uniqueCats = Array.from(new Set(data.map((d) => d.category)));
      return uniqueCats.filter(Boolean).sort();
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["test-templates-order", orgId, selectedCategory],
    queryFn: async () => {
      if (!orgId || !selectedCategory) return [];

      let query = supabase
        .from("v_test_templates_filtered")
        .select(`
          id, name, category, is_active, sort_order,
          organization_exam_settings ( custom_sort_order, id )
        `)
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .eq("category", selectedCategory);

      if (selectedCategory && selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Extract custom_sort_order and determine final sorting
      const processed = data.map((t: any) => {
        const settings = t.organization_exam_settings?.find((s: any) => s);
        const resolvedSortOrder = settings?.custom_sort_order ?? t.sort_order ?? 999999;
        return {
          ...t,
          custom_sort_order: settings?.custom_sort_order ?? null,
          settings_id: settings?.id ?? null,
          resolvedSortOrder,
        };
      });

      processed.sort((a, b) => {
        if (a.resolvedSortOrder === b.resolvedSortOrder) {
          return a.name.localeCompare(b.name);
        }
        return a.resolvedSortOrder - b.resolvedSortOrder;
      });

      return processed;
    },
    enabled: !!orgId && !!selectedCategory,
  });

  useEffect(() => {
    if (templates) {
      setLocalItems(templates);
      setIsDirty(false);
    }
  }, [templates]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const items = [...localItems];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    setLocalItems(items);
    setIsDirty(true);
  };

  const moveDown = (index: number) => {
    if (index === localItems.length - 1) return;
    const items = [...localItems];
    [items[index + 1], items[index]] = [items[index], items[index + 1]];
    setLocalItems(items);
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      if (localItems.length === 0) return;

      const upserts = localItems.map((item, index) => ({
        org_id: orgId,
        template_id: item.id,
        custom_sort_order: index + 1,
      }));

      const { error } = await supabase
        .from("organization_exam_settings")
        .upsert(upserts, { onConflict: 'org_id,template_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orden actualizado correctamente");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["test-templates-order"] });
    },
    onError: (err) => {
      toast.error("Error al guardar el orden: " + err.message);
    }
  });

  return (
    <Card className="bg-card rounded-xl border border-border shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Configuración de Orden de Impresión</h3>
          <p className="text-xs text-muted-foreground">
            Usa las flechas para subir o bajar los exámenes y definir el orden en que aparecerán agrupados en el reporte ({selectedCategory === "all" ? "Todas las categorías" : selectedCategory}).
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="flex-shrink-0"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading || categoriesLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground italic">Cargando exámenes...</p>
          </div>
        ) : localItems.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">No se encontraron exámenes para esta categoría.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-1">
            {localItems.map((item, index) => (
              <OrderableExamItem
                key={item.id}
                name={item.name}
                category={item.category}
                isActive={item.is_active}
                onMoveUp={index > 0 ? () => moveUp(index) : undefined}
                onMoveDown={index < localItems.length - 1 ? () => moveDown(index) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

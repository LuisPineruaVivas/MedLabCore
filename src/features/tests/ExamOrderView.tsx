import React, { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, Save } from "lucide-react";

type TemplateSetting = {
  custom_sort_order: number | null;
  id: string;
};

type ExamOrderItem = {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  sort_order: number | null;
  organization_exam_settings?: TemplateSetting[] | null;
  custom_sort_order?: number | null;
  settings_id?: string | null;
  resolvedSortOrder?: number;
};

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
  const [localItems, setLocalItems] = useState<ExamOrderItem[]>([]);
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

      const processed = (data as ExamOrderItem[]).map((t) => {
        const settings = t.organization_exam_settings?.find(Boolean);
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

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    const items = [...localItems];
    const [movedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, movedItem);

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
        .upsert(upserts, { onConflict: "org_id,template_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orden actualizado correctamente");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["test-templates-order"] });
    },
    onError: (err: Error) => {
      toast.error("Error al guardar el orden: " + err.message);
    },
  });

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="flex flex-col justify-between gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Configuracion de Orden de Impresion</h3>
          <p className="text-xs text-muted-foreground">
            Arrastra y suelta los examenes para definir el orden en que apareceran agrupados en el reporte (
            {selectedCategory === "all" ? "Todas las categorias" : selectedCategory}).
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder="Categoria" />
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
            <Save className="mr-2 h-4 w-4" />
            Guardar Cambios
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading || categoriesLoading ? (
          <div className="space-y-3 py-20 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm italic text-muted-foreground">Cargando examenes...</p>
          </div>
        ) : localItems.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-muted opacity-30" />
            <p className="text-sm text-muted-foreground">
              No se encontraron examenes para esta categoria.
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="exam-order-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="mx-auto flex max-w-3xl flex-col gap-2"
                >
                  {localItems.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(draggableProvided, snapshot) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                        >
                          <OrderableExamItem
                            name={item.name}
                            category={item.category}
                            isActive={item.is_active}
                            isDragging={snapshot.isDragging}
                            dragHandleProps={draggableProvided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </CardContent>
    </Card>
  );
}

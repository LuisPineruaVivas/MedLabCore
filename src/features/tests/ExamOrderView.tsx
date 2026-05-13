import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderableExamItem } from "./SortableExamItem";
import { useExamOrderTemplates, useSaveExamOrder, useTestCategories } from "./useTestTemplates";

type ExamOrderItem = {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
};

export function ExamOrderView() {
  const { orgId } = useCurrentOrgContext();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [localItems, setLocalItems] = useState<ExamOrderItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const { data: categories = [], isLoading: categoriesLoading } = useTestCategories();
  const { data: templates = [], isLoading } = useExamOrderTemplates(selectedCategory);
  const saveMutation = useSaveExamOrder();

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    setLocalItems(templates);
    setIsDirty(false);
  }, [templates]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) {
      return;
    }

    const items = [...localItems];
    const [movedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, movedItem);

    setLocalItems(items);
    setIsDirty(true);
  };

  const handleSave = () => {
    saveMutation.mutate(localItems, {
      onSuccess: () => {
        toast.success("Orden actualizado correctamente");
        setIsDirty(false);
      },
    });
  };

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
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!orgId || !isDirty || saveMutation.isPending}
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

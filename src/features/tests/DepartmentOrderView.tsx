import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { AlertCircle, Building2, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { cn } from "@/lib/utils";
import { useDepartmentOrder, useSaveDepartmentOrder } from "./useTestTemplates";

export function DepartmentOrderView() {
  const { orgId } = useCurrentOrgContext();
  const [localItems, setLocalItems] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const { data: departments = [], isLoading } = useDepartmentOrder();
  const saveMutation = useSaveDepartmentOrder();

  useEffect(() => {
    setLocalItems(departments);
    setIsDirty(false);
  }, [departments]);

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
    saveMutation.mutate(
      localItems.map((name) => ({ name })),
      {
        onSuccess: () => {
          toast.success("Orden de departamentos actualizado correctamente");
          setIsDirty(false);
        },
      },
    );
  };

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="flex flex-col justify-between gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Orden de Departamentos</h3>
          <p className="text-xs text-muted-foreground">
            Arrastra y suelta las categorias para definir el orden global en que apareceran las secciones del reporte PDF.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={!orgId || !isDirty || saveMutation.isPending}
          className="flex-shrink-0"
        >
          <Save className="mr-2 h-4 w-4" />
          Guardar Cambios
        </Button>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-3 py-20 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm italic text-muted-foreground">Cargando departamentos...</p>
          </div>
        ) : localItems.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-muted opacity-30" />
            <p className="text-sm text-muted-foreground">
              No se encontraron departamentos para ordenar.
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="department-order-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="mx-auto flex max-w-3xl flex-col gap-2"
                >
                  {localItems.map((department, index) => (
                    <Draggable key={department} draggableId={department} index={index}>
                      {(draggableProvided, snapshot) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition-all",
                            snapshot.isDragging && "border-primary/40 shadow-md ring-1 ring-primary/20",
                          )}
                        >
                          <button
                            type="button"
                            className="flex h-9 w-9 flex-shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                            title="Arrastra para reordenar"
                            aria-label={`Arrastrar ${department}`}
                            {...draggableProvided.dragHandleProps}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>

                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Building2 className="h-4 w-4 flex-shrink-0 text-primary" />
                            <span className="truncate text-sm font-medium">{department}</span>
                          </div>
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

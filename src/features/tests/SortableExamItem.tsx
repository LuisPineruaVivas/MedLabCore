import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { FlaskConical, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrderableExamItemProps {
  name: string;
  category: string;
  isActive: boolean;
  isDragging?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

export function OrderableExamItem({
  name,
  category,
  isActive,
  isDragging = false,
  dragHandleProps,
}: OrderableExamItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition-all",
        isDragging && "border-primary/40 shadow-md ring-1 ring-primary/20",
        !isActive && "opacity-60"
      )}
    >
      <button
        type="button"
        className="flex h-9 w-9 flex-shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        title="Arrastra para reordenar"
        aria-label={`Arrastrar ${name}`}
        {...dragHandleProps}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FlaskConical className="h-4 w-4 flex-shrink-0 text-primary" />
        <span
          className={cn(
            "truncate text-sm font-medium",
            !isActive && "text-muted-foreground line-through"
          )}
        >
          {name}
        </span>
      </div>

      <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
        {category}
      </Badge>
    </div>
  );
}

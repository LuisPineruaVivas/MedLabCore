import { FlaskConical, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OrderableExamItemProps {
  name: string;
  category: string;
  isActive: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function OrderableExamItem({
  name,
  category,
  isActive,
  onMoveUp,
  onMoveDown,
}: OrderableExamItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 bg-card border border-border rounded-lg shadow-sm mb-2 group transition-all",
        !isActive && "opacity-60"
      )}
    >
      <div className="flex flex-col gap-0.5 mr-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onMoveUp}
          disabled={!onMoveUp}
          title="Mover arriba"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onMoveDown}
          disabled={!onMoveDown}
          title="Mover abajo"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FlaskConical className="w-4 h-4 text-primary flex-shrink-0" />
        <span className={cn("font-medium text-sm truncate", !isActive && "line-through text-muted-foreground")}>
          {name}
        </span>
      </div>
      
      <Badge variant="outline" className="text-[10px] hidden sm:inline-flex shrink-0">
        {category}
      </Badge>
    </div>
  );
}

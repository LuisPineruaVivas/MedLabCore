import { ClipboardList } from "lucide-react";

export function Footer() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border mt-6 ">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center hidden md:flex">
          <ClipboardList className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs md:text-base font-semibold text-muted-foreground">MedLabCore EMS © 2026</span>
      </div>
      <div className="flex items-center gap-6 text-xs text-muted-foreground font-medium">
      </div>
      <div className="text-xs text-muted-foreground/60">
        System Version: v1.0.0-stable
      </div>
    </div>
  );
}
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 items-start justify-between gap-4 md:flex">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {/* Actions wrap instead of running off a phone screen. */}
      {actions && <div className="flex flex-wrap items-center gap-2 pt-3 md:shrink-0 md:pt-0">{actions}</div>}
    </div>
  );
}

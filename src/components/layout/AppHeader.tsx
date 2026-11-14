import { useBrand } from "@/contexts/BrandContext";
import { ThemeToggle } from "./ThemeToggle";

/** Lab initials for the logo tile when the lab has no logo. */
export function labInitials(name: string) {
  return name.split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word) && !/^(de|del|la|el|los|las|y)$/i.test(word)).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "LC";
}

/**
 * Compact bar. Phone: the lab's logo and name (there is no rail). Desktop: the rail already
 * carries the lab, so the bar shows today's date. Theme switch on the right.
 */
export function AppHeader() {
  const { brand, isLoading } = useBrand();
  const labName = brand.name || "MedLabCore";
  const longDate = new Date().toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
  const today = longDate.charAt(0).toUpperCase() + longDate.slice(1);

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-6">
        {isLoading ? (
          <div className="h-9 w-40 rounded-lg neu-inset" aria-hidden />
        ) : (
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={`Logo de ${labName}`} className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5 neu-raised" />
            ) : (
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                {labInitials(labName)}
              </span>
            )}
            <p className="min-w-0 truncate text-sm font-semibold">{labName}</p>
          </div>
        )}
        <p className="hidden text-sm text-muted-foreground md:block">{today}</p>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

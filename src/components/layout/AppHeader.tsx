import { useBrand } from "@/contexts/BrandContext";
import { ThemeToggle } from "./ThemeToggle";

/** Lab initials for the logo tile when the lab has no logo. */
export function labInitials(name: string) {
  return name.split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word) && !/^(de|del|la|el|los|las|y)$/i.test(word)).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "LC";
}

/** The lab's two colors, used by the header band and the top of the rail so they read as one strip. */
export function labGradient(brand: { primaryColor: string; secondaryColor: string }) {
  return `linear-gradient(90deg, ${brand.primaryColor}, ${brand.secondaryColor})`;
}

/**
 * The lab's own band: its colors, logo and contact line, so every lab sees its identity on every page.
 * The app's brand lives in the rail. Today's date (desktop) and the theme switch sit on the right.
 */
export function AppHeader() {
  const { brand, isLoading } = useBrand();
  const labName = brand.name || "MedLabCore";
  const labInfo = brand.email || brand.phone || brand.address;
  const longDate = new Date().toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
  const today = longDate.charAt(0).toUpperCase() + longDate.slice(1);

  if (isLoading) {
    return <header aria-hidden className="h-20 animate-pulse rounded-b-3xl bg-muted md:h-28 md:rounded-bl-none md:rounded-br-[3rem]" />;
  }

  return (
    <header
      className="relative z-30 text-white shadow-md rounded-b-[2rem] md:rounded-bl-none md:rounded-br-[3rem]"
      style={{ background: labGradient(brand) }}
    >
      {/* Light lab colors still need readable white text. */}
      <div className="flex h-20 items-center gap-3 px-4 [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] sm:px-6 md:h-28 md:gap-4">
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt={`Logo de ${labName}`}
            className="h-16 w-auto max-w-[9rem] shrink-0 rounded-xl bg-white object-contain p-1 shadow-md md:h-24 md:max-w-[14rem]"
          />
        ) : (
          <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/20 text-xl font-bold md:h-24 md:w-24 md:text-3xl">
            {labInitials(labName)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold md:text-lg">{labName}</p>
          {labInfo && <p className="truncate text-xs text-white/90 md:text-sm">{labInfo}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <p className="hidden text-sm text-white/90 lg:block">{today}</p>
          <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />
        </div>
      </div>
    </header>
  );
}

import { useBrand } from "@/contexts/BrandContext";

export function AppHeader() {
  const { brand, isLoading: isBrandLoading } = useBrand();

  const labName = brand.name || "MedLabCore";
  const labInfo = brand.email || brand.phone || brand.address || "Laboratorio";

  if (isBrandLoading) {
    return (
      <header className="sticky top-0 z-30 ">
        <div className="flex items-center justify-center px-4 sm:px-6 h-28 text-white bg-gray-200 animate-pulse">
          <div className="h-10 w-32 bg-gray-300 rounded"></div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 ">
      <div
        className="flex items-center justify-center px-4 sm:px-6 h-28 text-white"
        style={{
          background: `linear-gradient(90deg, ${brand.primaryColor}, ${brand.secondaryColor})`,
          borderRadius: "0 0 50px 50px",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-24 w-auto rounded-md overflow-hidden bg-white flex items-center justify-center">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={`${labName} logo`} className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs uppercase tracking-wider">{labName.slice(0, 2)}</span>
            )}
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="truncate text-sm font-semibold">{labName}</p>
            <p className="truncate text-xs text-white/90">{labInfo}</p>
          </div>
        </div>

      </div>

    </header>
  );
}

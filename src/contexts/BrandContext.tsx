import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";

interface BrandConfig {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface BrandContextType {
  brand: BrandConfig;
  isLoading: boolean;
}

const DEFAULT_BRAND: BrandConfig = {
  logoUrl: null,
  primaryColor: "#0ea5e9", // Clinical professional blue fallback
  secondaryColor: "#38bdf8",
  name: "LabCore",
  email: "",
  phone: "",
  address: "",
};

const BrandContext = createContext<BrandContextType>({
  brand: DEFAULT_BRAND,
  isLoading: true,
});

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { organization, isLoading } = useCurrentOrgContext();

  const brand = useMemo(
    () => ({
      logoUrl: organization?.logo_url || DEFAULT_BRAND.logoUrl,
      primaryColor: organization?.primary_color || DEFAULT_BRAND.primaryColor,
      secondaryColor: organization?.secondary_color || DEFAULT_BRAND.secondaryColor,
      name: organization?.name || DEFAULT_BRAND.name,
      email: organization?.email || DEFAULT_BRAND.email,
      phone: organization?.phone || DEFAULT_BRAND.phone,
      address: organization?.address || DEFAULT_BRAND.address,
    }),
    [organization]
  );

  useEffect(() => {
    // Inject CSS variables into the root
    document.documentElement.style.setProperty("--primary-brand", brand.primaryColor);
    document.documentElement.style.setProperty("--secondary-brand", brand.secondaryColor);
  }, [brand.primaryColor, brand.secondaryColor]);

  return (
    <BrandContext.Provider value={{ brand, isLoading }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}

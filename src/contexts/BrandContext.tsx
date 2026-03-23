import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

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
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const orgId = profile?.org_id;

  const { data: orgData, isLoading } = useQuery({
    queryKey: ["organization-brand", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("name, address, phone, email, logo_url, primary_color, secondary_color")
        .eq("id", orgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orgId,
  });

  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);

  useEffect(() => {
    const currentBrand = {
      logoUrl: orgData?.logo_url || DEFAULT_BRAND.logoUrl,
      primaryColor: orgData?.primary_color || DEFAULT_BRAND.primaryColor,
      secondaryColor: orgData?.secondary_color || DEFAULT_BRAND.secondaryColor,
      name: orgData?.name || DEFAULT_BRAND.name,
      email: orgData?.email || DEFAULT_BRAND.email,
      phone: orgData?.phone || DEFAULT_BRAND.phone,
      address: orgData?.address || DEFAULT_BRAND.address,
    };

    setBrand(currentBrand);

    // Inject CSS variables into the root
    document.documentElement.style.setProperty("--primary-brand", currentBrand.primaryColor);
    document.documentElement.style.setProperty("--secondary-brand", currentBrand.secondaryColor);

    return () => {
      // Optional: cleanup or let it persist
    };
  }, [orgData]);

  return (
    <BrandContext.Provider value={{ brand, isLoading }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}

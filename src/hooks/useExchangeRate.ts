import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const DOLAR_API_URL = "https://ve.dolarapi.com/v1/dolares";

interface DolarApiItem {
  moneda: string;
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

export interface ExchangeRateData {
  rate: number;
  updated_at: string;
  source: "api" | "database";
  provider: string;
}

async function fetchExchangeRateFromApi(): Promise<ExchangeRateData> {
  const response = await fetch(DOLAR_API_URL, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("No se pudo obtener la tasa del proveedor externo");
  }

  const payload = (await response.json()) as DolarApiItem[];
  const preferredRate =
    payload.find((item) => item.moneda === "USD" && item.fuente === "oficial") ??
    payload.find((item) => item.moneda === "USD") ??
    payload[0];

  if (!preferredRate || typeof preferredRate.promedio !== "number") {
    throw new Error("El proveedor externo no devolvió una tasa válida");
  }

  return {
    rate: Number(preferredRate.promedio),
    updated_at: preferredRate.fechaActualizacion,
    source: "api",
    provider: `dolarapi:${preferredRate.fuente}`,
  };
}

async function fetchExchangeRateFromDatabase(orgId: string): Promise<ExchangeRateData | null> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("rate, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    rate: Number(data.rate),
    updated_at: data.updated_at,
    source: "database",
    provider: "supabase",
  };
}

export function useExchangeRate(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.exchangeRate(orgId),
    queryFn: async () => {
      try {
        return await fetchExchangeRateFromApi();
      } catch (apiError) {
        if (!orgId) {
          throw apiError;
        }

        const fallbackRate = await fetchExchangeRateFromDatabase(orgId);
        if (fallbackRate) {
          return fallbackRate;
        }

        throw apiError;
      }
    },
    enabled: true,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });
}

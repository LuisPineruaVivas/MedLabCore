import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export function ExchangeRateSettings({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [rate, setRate] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("exchange_rates")
          .select("rate, updated_at")
          .eq("org_id", orgId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setRate(String(data.rate));
          setUpdatedAt(data.updated_at);
        }
      } catch {
        toast.error("Error cargando tasa de cambio");
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [orgId]);

  async function handleSave() {
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate <= 0) {
      toast.error("Ingresa una tasa válida mayor a 0");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("exchange_rates")
        .upsert(
          {
            org_id: orgId,
            rate: numRate,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          },
          { onConflict: "org_id" }
        );

      if (error) throw error;
      setUpdatedAt(new Date().toISOString());
      toast.success("Tasa de cambio actualizada");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tasa de Cambio (1 USD = ? BS)</Label>
        <div className="flex gap-2 items-center">
          <span className="text-sm font-semibold text-muted-foreground">1 USD =</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Ej: 36.50"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="max-w-[160px] mono"
          />
          <span className="text-sm font-semibold text-muted-foreground">BS</span>
        </div>
        {updatedAt && (
          <p className="text-xs text-muted-foreground">
            Última actualización: {format(new Date(updatedAt), "dd/MM/yyyy HH:mm")}
          </p>
        )}
      </div>

      <Button onClick={handleSave} disabled={loading} size="sm">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        Actualizar Tasa
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import {
  useManualExchangeRate,
  useSaveManualExchangeRate,
} from "./useOrganizationSettings";

export function ExchangeRateSettings({ orgId }: { orgId: string }) {
  const { user } = useCurrentOrgContext();
  const [rate, setRate] = useState("");
  const { data, isLoading } = useManualExchangeRate(orgId);
  const saveMutation = useSaveManualExchangeRate(orgId);

  useEffect(() => {
    if (data?.rate != null) {
      setRate(String(data.rate));
    }
  }, [data]);

  const handleSave = async () => {
    const parsedRate = parseFloat(rate);
    if (Number.isNaN(parsedRate) || parsedRate <= 0) {
      toast.error("Ingresa una tasa valida mayor a 0");
      return;
    }

    await saveMutation.mutateAsync({
      orgId,
      rate: parsedRate,
      updatedBy: user?.id,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

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
            onChange={(event) => setRate(event.target.value)}
            className="max-w-[160px] mono"
          />
          <span className="text-sm font-semibold text-muted-foreground">BS</span>
        </div>
        {data?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Ultima actualizacion: {format(new Date(data.updated_at), "dd/MM/yyyy HH:mm")}
          </p>
        )}
      </div>

      <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm">
        {saveMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Actualizar Tasa
      </Button>
    </div>
  );
}

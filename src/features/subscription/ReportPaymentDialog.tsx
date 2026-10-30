import { useState, useId } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useReportSubscriptionPayment } from "./useSubscriptionPayments";
import { DollarSign, Upload, CheckCircle2, Clock, AlertCircle, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ReportPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHODS = [
  { id: "pago_movil", label: "Pago Móvil" },
  /*{ id: "transferencia_bs", label: "Transferencia Bancaria (Bs)" },
  { id: "zelle", label: "Zelle (USD)" },
  { id: "binance", label: "Binance USDT" },
  { id: "deposito_dolares", label: "Depósito / Efectivo USD" },*/
];

export function ReportPaymentDialog({ open, onOpenChange }: ReportPaymentDialogProps) {
  const { orgId, organization } = useCurrentOrgContext();
  const { data: exchangeRateData } = useExchangeRate(orgId);
  const reportMutation = useReportSubscriptionPayment(orgId);

  const fileInputId = useId();
  const priceUsd = Number(organization?.subscription_plan_price ?? 29.0);
  const rate = exchangeRateData?.rate ? Number(exchangeRateData.rate) : null;
  const amountBs = rate ? priceUsd * rate : null;

  const [paymentMethod, setPaymentMethod] = useState<string>("pago_movil");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 8 * 1024 * 1024) {
        toast.error("El archivo no debe exceder los 8MB");
        return;
      }
      setFile(selected);
      if (selected.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) {
      toast.error("No se encontró la organización activa");
      return;
    }
    if (!referenceNumber.trim()) {
      toast.error("Por favor ingrese el número de referencia del pago");
      return;
    }
    if (!file) {
      toast.error("Por favor adjunte el comprobante o captura de pantalla");
      return;
    }

    try {
      await reportMutation.mutateAsync({
        org_id: orgId,
        amount_usd: priceUsd,
        amount_bs: amountBs ? Number(amountBs.toFixed(2)) : null,
        exchange_rate: rate,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim(),
        payment_date: paymentDate,
        proof_file: file,
        notes: notes.trim() || null,
      });

      // Reset form
      setReferenceNumber("");
      setNotes("");
      setFile(null);
      setPreviewUrl(null);
      onOpenChange(false);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Reportar Pago de Suscripción</DialogTitle>
              <DialogDescription className="text-xs">
                Sube tu comprobante de pago para mantener activo el servicio de tu laboratorio.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Monto Box */}
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Monto a Pagar
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-foreground">${priceUsd.toFixed(2)} USD</span>
              <span className="text-xs text-muted-foreground">/ mes</span>
            </div>
          </div>

          {amountBs !== null && rate && (
            <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[11px] font-medium text-muted-foreground">Al cambio en Bolívares:</span>
              <div className="text-base font-bold text-primary">
                Bs. {amountBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Tasa BCV/Oficial: Bs. {rate.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Alerta de Período de Gracia */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Período de gracia automático:</strong> Al reportar este pago, el sistema activará inmediatamente{" "}
            <strong>3 días de gracia</strong> para garantizar que el laboratorio siga operando sin pausas mientras validamos tu comprobante.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecciona el método" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.id} value={method.id} className="text-xs">
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fecha de la Transferencia</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Número de Referencia</Label>
            <Input
              type="text"
              placeholder="Ej. 12345678"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Subida de Archivo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Comprobante de Pago (Foto / Captura / PDF)</Label>
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors bg-muted/20">
              <input
                id={fileInputId}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor={fileInputId} className="cursor-pointer block">
                {previewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={previewUrl}
                      alt="Vista previa comprobante"
                      className="max-h-40 mx-auto rounded-lg object-contain border border-border shadow-sm"
                    />
                    <p className="text-xs text-primary font-medium">Click para cambiar imagen</p>
                  </div>
                ) : file ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
                    <p className="text-xs font-medium text-foreground">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">Click para seleccionar otro archivo</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-xs font-medium text-foreground">
                      Haz clic para subir el comprobante
                    </p>
                    <p className="text-[11px] text-muted-foreground">PNG, JPG o PDF hasta 8MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Observaciones (Opcional)</Label>
            <Textarea
              placeholder="Ej. Pago realizado desde cuenta Banco Mercantil a nombre del titular..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={reportMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={reportMutation.isPending}>
              {reportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo reporte...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Enviar Reporte de Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

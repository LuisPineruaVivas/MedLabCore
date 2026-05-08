import { PDFViewer } from "@react-pdf/renderer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UnifiedTestReportPDF } from "@/lib/unifiedTestReportPDF";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: unknown;
  orderItems: unknown[];
  patientData: {
    name: string;
    id: string;
    date: string;
    age: string | number;
    gender: string;
  };
  labData: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    primary_color?: string;
    secondary_color?: string;
  };
}

export function ReportPreviewDialog({
  open,
  onOpenChange,
  order,
  orderItems,
  patientData,
  labData,
}: ReportPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle>Informe de Resultados</DialogTitle>
          <DialogDescription>Revisa el informe de resultados antes de imprimir</DialogDescription>
        </DialogHeader>
        <div className="h-full flex-1 overflow-hidden rounded-md border bg-muted">
          {orderItems.length > 0 ? (
            <PDFViewer width="100%" height="100%" className="border-none">
              <UnifiedTestReportPDF
                orden={order as never}
                orderItems={orderItems as never}
                patientData={{ ...patientData, age: `${patientData.age} Años` }}
                labData={labData}
              />
            </PDFViewer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Cargando datos del reporte...</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ReceiptPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItemsCount: number;
  thermalReceiptData: ThermalReceiptData;
  thermalPrinting: boolean;
  onPrintThermal: (paperMm: 58 | 80) => void;
  thermalPaperOpen: boolean;
  setThermalPaperOpen: (open: boolean) => void;
  thermalPaperMm: "58" | "80";
  setThermalPaperMm: (mm: "58" | "80") => void;
}

export function ReceiptPreviewDialog({
  open,
  onOpenChange,
  orderItemsCount,
  thermalReceiptData,
  thermalPrinting,
  onPrintThermal,
  thermalPaperOpen,
  setThermalPaperOpen,
  thermalPaperMm,
  setThermalPaperMm,
}: ReceiptPreviewDialogProps) {
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[95vw] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Nota de Entrega</DialogTitle>
          <DialogDescription>Revisa la nota de entrega antes de imprimir</DialogDescription>
        </DialogHeader>
        <div className="h-full flex-1 overflow-hidden rounded-md border bg-muted">
          {orderItemsCount > 0 ? (
            <PDFViewer width="100%" height="100%" className="border-none">
              <OrderThermalReceiptPDF {...thermalReceiptData} />
            </PDFViewer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Cargando datos...</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {/*<Button
              variant="outline"
              onClick={() => setThermalPaperOpen(true)}
              disabled={thermalPrinting}
            >
              {thermalPrinting ? "Imprimiendo..." : "Imprimir térmica"}
            </Button>*/}
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={thermalPaperOpen} onOpenChange={setThermalPaperOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ancho del papel</DialogTitle>
            <DialogDescription>
              Elige el ancho que coincida con tu impresora térmica (58&nbsp;mm estándar tipo ticket, 80&nbsp;mm ancho).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="thermal-paper-mm">Impresora</Label>
            <Select value={thermalPaperMm} onValueChange={(v) => setThermalPaperMm(v as "58" | "80")}>
              <SelectTrigger id="thermal-paper-mm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58">58&nbsp;mm (POS-58 / ticket estrecho)</SelectItem>
                <SelectItem value="80">80&nbsp;mm (POS-80 / ticket ancho)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setThermalPaperOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={thermalPrinting}
              onClick={async () => {
                const mm = thermalPaperMm === "80" ? 80 : 58;
                setThermalPaperOpen(false);
                await onPrintThermal(mm);
              }}
            >
              {thermalPrinting ? "Imprimiendo..." : "Imprimir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>

  );
}

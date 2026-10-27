import { PDFViewer } from "@react-pdf/renderer";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";
import type { buildOrderReceiptData } from "./createOrderUtils";
import type { CreateOrderLabData } from "./useCreateOrderDialog";

/** After creating the order: the delivery note, optional payment, close. */
export function CreateOrderReceiptStep({
  receiptData,
  labData,
  showRegisterPayment,
  onRegisterPayment,
  onClose,
}: {
  receiptData: ReturnType<typeof buildOrderReceiptData>;
  labData?: CreateOrderLabData;
  showRegisterPayment: boolean;
  onRegisterPayment: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-primary" />
          Nota de Entrega
        </DialogTitle>
        <DialogDescription>Imprima o descargue esta nota para el paciente.</DialogDescription>
      </DialogHeader>
      <div className="h-[calc(100dvh-12rem)] min-h-80 w-full overflow-hidden rounded-lg border border-border sm:h-[65vh]">
        <PDFViewer width="100%" height="100%" showToolbar>
          <OrderThermalReceiptPDF
            orderId={receiptData.order_seq ?? ""}
            orderDate={receiptData.orderDate}
            patientName={receiptData.patientName}
            patientId={receiptData.patientId}
            age={receiptData.age}
            gender={receiptData.gender}
            items={receiptData.items}
            total={receiptData.total}
            accessPin={receiptData.accessPin}
            portalUrl={`${window.location.origin}/portal-paciente`}
            labData={labData}
            exchangeRate={receiptData.exchangeRate}
            totalBs={receiptData.totalBs}
          />
          {/*<OrderReceiptPDF
            orderId={receiptData.orderId}
            orderDate={receiptData.orderDate}
            patientName={receiptData.patientName}
            patientId={receiptData.patientId}
            items={receiptData.items}
            total={receiptData.total}
            accessPin={receiptData.accessPin}
            portalUrl={`${window.location.origin}/portal-paciente`}
            labData={labData}
            exchangeRate={receiptData.exchangeRate}
            totalBs={receiptData.totalBs}
          />*/}
        </PDFViewer>
      </div>
      <DialogFooter>
        {showRegisterPayment && (
          <Button variant="outline" onClick={onRegisterPayment}>Registrar pago</Button>
        )}
        {/*<Button variant="outline" onClick={handleThermalPrint} disabled={thermalPrinting}>
          {thermalPrinting ? "Imprimiendo..." : "Imprimir Termica"}
        </Button>*/}
        <Button
          onClick={onClose}
        >
          Cerrar
        </Button>
      </DialogFooter>
      </>
    </>
  );
}

import { cn } from "@/lib/utils";
import { FileText, ShoppingCart } from "lucide-react";
import { OrderPaymentDialog } from "@/features/erp/components/OrderPaymentDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CreateOrderCartSummary } from "./CreateOrderCartSummary";
import { CreateOrderExamPicker } from "./CreateOrderExamPicker";
import { CreateOrderPatientPicker } from "./CreateOrderPatientPicker";
import { CreateOrderReceiptStep } from "./CreateOrderReceiptStep";
import { type CreateOrderLabData, useCreateOrderDialog } from "./useCreateOrderDialog";

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  labData?: CreateOrderLabData;
}

export function CreateOrderDialog({ open, onOpenChange, onSuccess, labData }: CreateOrderDialogProps) {
  const {
    createOrder,
    notes,
    setNotes,
    isGeneratingBudget,
    paymentOpen,
    isErpEnabled,
    canRegisterPayments,
    currentRate,
    patientSearch,
    setPatientSearch,
    selectedPatient,
    setSelectedPatient,
    showQuickRegister,
    setShowQuickRegister,
    testSearch,
    setTestSearch,
    cart,
    isExempted,
    setIsExempted,
    receiptData,
    createdInvoiceId,
    setPaymentOpen,
    patients,
    searchingPatients,
    canExemptOrder,
    filteredItems,
    total,
    totalBs,
    effectiveTotals,
    addToCart,
    handleRemoveCartItem,
    resetDialog,
    createPatientMutation,
    handleCreateOrder,
    handleGenerateBudget,
  } = useCreateOrderDialog({ onOpenChange, onSuccess, labData });

  function close() {
    resetDialog();
    onOpenChange(false);
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetDialog();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className={cn(
        "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none overflow-y-auto p-4 sm:max-h-[70vh] sm:w-[70vw] sm:p-6",
        receiptData ? "sm:max-h-[95vh] sm:max-w-2xl" : "sm:max-w-5xl sm:h-[90vh]",
        "sm:h-auto"
      )}>
        {receiptData ? (
          <CreateOrderReceiptStep
            receiptData={receiptData}
            labData={labData}
            invoiceId={isErpEnabled && canRegisterPayments && !isExempted ? createdInvoiceId : null}
            onRegisterPayment={() => setPaymentOpen(true)}
            onClose={close}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Nueva Orden
              </DialogTitle>
              <DialogDescription className="text-base">
                Busca el paciente y selecciona los examenes para crear una nueva orden.
              </DialogDescription>
            </DialogHeader>

            <CreateOrderPatientPicker
              selectedPatient={selectedPatient}
              setSelectedPatient={setSelectedPatient}
              patientSearch={patientSearch}
              setPatientSearch={setPatientSearch}
              patients={patients}
              searchingPatients={searchingPatients}
              showQuickRegister={showQuickRegister}
              setShowQuickRegister={setShowQuickRegister}
              onCreatePatient={(data) => createPatientMutation.mutateAsync(data)}
            />

            <Separator />

            <div className="mb-2 flex flex-col gap-4 lg:h-96 lg:flex-row">
              <CreateOrderExamPicker
                testSearch={testSearch}
                setTestSearch={setTestSearch}
                filteredItems={filteredItems}
                cart={cart}
                addToCart={addToCart}
              />
              <CreateOrderCartSummary
                cart={cart}
                handleRemoveCartItem={handleRemoveCartItem}
                canExemptOrder={canExemptOrder}
                isExempted={isExempted}
                setIsExempted={setIsExempted}
                total={total}
                totalBs={totalBs}
                effectiveTotals={effectiveTotals}
                currentRate={currentRate}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Notas (Diagnostico o Sintomas)</Label>
              <Textarea
                placeholder="Ingrese el diagnostico o sintomas que presenta el paciente..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleGenerateBudget}
                  disabled={cart.length === 0 || isGeneratingBudget}
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  {isGeneratingBudget ? "Generando..." : "Generar Presupuesto"}
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  disabled={!selectedPatient || cart.length === 0 || createOrder.isPending}
                >
                  {createOrder.isPending ? "Cargando..." : "Crear Orden"}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    <OrderPaymentDialog invoiceId={createdInvoiceId} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </>
  );
}

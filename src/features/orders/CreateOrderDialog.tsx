import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, X, UserPlus, ShoppingCart, Printer, Package, FlaskConical, FileText } from "lucide-react";
import { toast } from "sonner";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { cn } from "@/lib/utils";
import { OrderReceiptPDF } from "@/lib/orderReceiptPDF";
import { OrderBudgetPDF } from "@/lib/orderBudgetPDF";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { OrderPaymentDialog } from "@/features/erp/components/OrderPaymentDialog";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NewPatientDialog } from "../patients/NewPatientDialog";
import type { PatientFormData } from "../patients/schemas";
import { useCreatePatient, usePatientSearch } from "../patients/usePatients";
import { useOrderProfiles, useOrderTemplates } from "../tests/useTestTemplates";
import { useCreateOrder } from "./useOrders";
import {
  addSearchItemToCart,
  buildOrderBudgetData,
  buildOrderReceiptData,
  buildSearchItems,
  buildSelectedPatientSummary,
  calculateCartTotal,
  calculateCartTotalBs,
  CartItem,
  filterSearchItems,
  removeCartItem,
  resolveOrderTotals,
  SearchItem,
} from "./createOrderUtils";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";

type SelectedPatient = {
  id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  date_of_birth?: string | null;
  gender?: string | null;
};

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  labData?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    primary_color?: string;
  };
}

function isMobileReceiptFlow() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  );
}

export function CreateOrderDialog({ open, onOpenChange, onSuccess, labData }: CreateOrderDialogProps) {
  const { orgId, user, role } = useCurrentOrgContext();
  const { isErpEnabled, canRegisterPayments } = useErpModule();
  const createOrder = useCreateOrder();
  const queryClient = useQueryClient();
  const { data: exchangeRateData } = useExchangeRate(orgId);
  const currentRate = exchangeRateData?.rate ? Number(exchangeRateData.rate) : null;

  const [patientSearch, setPatientSearch] = useState("");
  const debouncedSearch = useDebounce(patientSearch, 500);
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [testSearch, setTestSearch] = useState("");
  const testSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isExempted, setIsExempted] = useState(false);
  const [receiptData, setReceiptData] = useState<ReturnType<typeof buildOrderReceiptData> | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [isGeneratingBudget, setIsGeneratingBudget] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: patients = [], isFetching: searchingPatients } = usePatientSearch(debouncedSearch);
  const { data: templates = [] } = useOrderTemplates();
  const { data: examProfiles = [] } = useOrderProfiles();
  const canExemptOrder = role !== "lab_affiliate";

  const allSearchItems = useMemo(
    () => buildSearchItems(templates, examProfiles),
    [templates, examProfiles]
  );
  const filteredItems = useMemo(
    () => filterSearchItems(allSearchItems, testSearch),
    [allSearchItems, testSearch]
  );
  const total = useMemo(() => calculateCartTotal(cart), [cart]);
  const totalBs = useMemo(() => calculateCartTotalBs(total, currentRate), [currentRate, total]);
  const effectiveTotals = useMemo(
    () => resolveOrderTotals(total, totalBs, isExempted),
    [isExempted, total, totalBs]
  );

  function addToCart(item: SearchItem) {
    setCart((previousCart) => addSearchItemToCart(previousCart, item));
  }

  function handleRemoveCartItem(item: CartItem) {
    setCart((previousCart) => removeCartItem(previousCart, item));
  }

  function resetDialog() {
    setPatientSearch("");
    setSelectedPatient(null);
    setShowQuickRegister(false);
    setTestSearch("");
    setCart([]);
    setReceiptData(null);
    setNotes("");
    setIsExempted(false);
    setCreatedInvoiceId(null);
    setPaymentOpen(false);
  }

  const createMutation = useCreatePatient();

  const createPatientMutation = useMutation({
    mutationFn: async (formData: PatientFormData) => {
      await createMutation.mutateAsync(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.all(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.search(orgId, debouncedSearch) });
      toast.success("Paciente creado correctamente");
    },
    onError: (error: Error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo crear el paciente"));
    },
  });

  async function handleCreateOrder() {
    if (!selectedPatient || !orgId || !user?.id || cart.length === 0) {
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        orgId,
        patientId: selectedPatient.id,
        createdBy: user.id,
        items: cart.map((item) => ({
          template_id: item.template_id,
          test_name: item.test_name,
          price: item.price,
          schema: item.schema,
          isProfileHeader: item.isProfileHeader,
          profileId: item.profileId,
          parentProfileId: item.parentProfileId,
        })),
        notes: notes.trim() || null,
        exchangeRate: currentRate,
        totalBs: effectiveTotals.totalBs,
        isExempted,
      });

      toast.success("Orden creada correctamente");
      const invoiceId = (order as { invoiceId?: string | null }).invoiceId ?? null;
      setCreatedInvoiceId(invoiceId);

      const generatedReceiptData = buildOrderReceiptData({
        orderId: String((order as { orderId?: string }).orderId),
        order_seq: (order as { order_seq?: number | null }).order_seq,
        selectedPatient,
        cart,
        total: effectiveTotals.total,
        accessPin: (order as { access_pin?: string | null }).access_pin,
        exchangeRate: currentRate,
        totalBs: effectiveTotals.totalBs,
      });

      if (role === "lab_affiliate") {
        resetDialog();
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      if (isMobileReceiptFlow()) {
        const receiptBlob = await pdf(
          <OrderReceiptPDF
            orderId={generatedReceiptData.orderId}
            orderDate={generatedReceiptData.orderDate}
            patientName={generatedReceiptData.patientName}
            patientId={generatedReceiptData.patientId}
            items={generatedReceiptData.items}
            total={generatedReceiptData.total}
            accessPin={generatedReceiptData.accessPin}
            portalUrl={`${window.location.origin}/portal-paciente`}
            labData={labData}
            exchangeRate={generatedReceiptData.exchangeRate}
            totalBs={generatedReceiptData.totalBs}
          />
        ).toBlob();

        const url = URL.createObjectURL(receiptBlob);
        window.open(url, "_blank");
        setReceiptData(null);
        onOpenChange(false);
      } else {
        setReceiptData(generatedReceiptData);
      }

      onSuccess?.();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "No se pudo crear la orden"));
    }
  }

  async function handleThermalPrint() {
    if (!receiptData) {
      return;
    }

    setThermalPrinting(true);
    try {
      const thermalData: ThermalReceiptData = {
        ...receiptData,
        portalUrl: `${window.location.origin}/portal-paciente`,
        labData,
      };

      await printThermalReceipt(thermalData);
      toast.success("Recibo enviado a la impresora termica");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo imprimir el recibo";
      toast.error(message);
    } finally {
      setThermalPrinting(false);
    }
  }

  async function handleGenerateBudget() {
    if (cart.length === 0) {
      return;
    }

    setIsGeneratingBudget(true);

    const pdfWindow = window.open("", "_blank");
    if (pdfWindow) {
      pdfWindow.document.title = "Generando Presupuesto...";
      pdfWindow.document.body.innerHTML =
        "<div style='display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#475569;'>Generando documento de presupuesto...</div>";
    }

    try {
      const budgetData = buildOrderBudgetData({
        selectedPatient,
        cart,
        total: effectiveTotals.total,
        exchangeRate: currentRate,
        totalBs: effectiveTotals.totalBs,
        notes,
      });

      const budgetBlob = await pdf(
        <OrderBudgetPDF
          budgetDate={budgetData.budgetDate}
          patientName={budgetData.patientName}
          patientId={budgetData.patientId}
          items={budgetData.items}
          total={budgetData.total}
          labData={labData}
          exchangeRate={budgetData.exchangeRate}
          totalBs={budgetData.totalBs}
          notes={budgetData.notes}
        />
      ).toBlob();

      const url = URL.createObjectURL(budgetBlob);
      if (pdfWindow) {
        pdfWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } catch (error) {
      if (pdfWindow) {
        pdfWindow.close();
      }
      toast.error(getUserFacingErrorMessage(error, "No se pudo generar el presupuesto"));
    } finally {
      setIsGeneratingBudget(false);
    }
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
        receiptData ? "sm:max-w-4xl" : "sm:max-w-5xl sm:h-[90vh]",
        "sm:h-auto"
      )}>
        {receiptData ? (
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
                  orderId={receiptData.order_seq}
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
              {isErpEnabled && canRegisterPayments && createdInvoiceId && !isExempted && (
                <Button variant="outline" onClick={() => setPaymentOpen(true)}>Registrar pago</Button>
              )}
              {/*<Button variant="outline" onClick={handleThermalPrint} disabled={thermalPrinting}>
                {thermalPrinting ? "Imprimiendo..." : "Imprimir Termica"}
              </Button>*/}
              <Button
                onClick={() => {
                  resetDialog();
                  onOpenChange(false);
                }}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </>
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

            <div className="space-y-3">
              <Label className="text-sm font-semibold">1. Paciente</Label>

              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {buildSelectedPatientSummary(selectedPatient)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientSearch("");
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Buscar paciente por nombre o cedula..."
                      value={patientSearch}
                      onChange={(event) => {
                        setPatientSearch(event.target.value);
                        setShowQuickRegister(false);
                      }}
                    />
                  </div>

                  {patientSearch.length >= 2 && patients.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-40 overflow-y-auto">
                      {patients.map((patient) => (
                        <button
                          key={patient.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedPatient(patient as SelectedPatient);
                            setPatientSearch("");
                          }}
                        >
                          <p className="text-sm font-medium">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">ID: {patient.id_number}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {patientSearch.length >= 2 && patients.length === 0 && !searchingPatients && (
                    <div className="text-center py-3 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        No se encontraron pacientes con estos datos
                      </p>
                      {!showQuickRegister && (
                        <Button variant="outline" size="sm" onClick={() => setShowQuickRegister(true)}>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Registrar paciente
                        </Button>
                      )}
                    </div>
                  )}

                  {showQuickRegister && (
                    <NewPatientDialog
                      open={showQuickRegister}
                      onOpenChange={setShowQuickRegister}
                      onSubmit={(data) => createPatientMutation.mutateAsync(data)}
                    />
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div className="mb-2 flex flex-col gap-4 lg:h-96 lg:flex-row">
              <div className="w-full space-y-4 h-full flex flex-col">
                <Label className="text-sm font-semibold">2. Selecciona los examenes a realizar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={testSearchInputRef}
                    className="pl-9"
                    placeholder="Buscar examen..."
                    value={testSearch}
                    onChange={(event) => setTestSearch(event.target.value)}
                  />
                </div>

                <div className="max-h-[32vh] overflow-y-auto divide-y divide-border rounded-lg border border-border lg:max-h-none">
                  {filteredItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron examenes con estos datos
                    </p>
                  ) : (
                    filteredItems.map((item) => {
                      const inCart =
                        item.type === "exam"
                          ? cart.some((cartItem) => cartItem.template_id === item.id && !cartItem.parentProfileId)
                          : cart.some((cartItem) => cartItem.isProfileHeader && cartItem.profileId === item.id);

                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          className={cn(
                            "w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors",
                            inCart ? "bg-accent/40 cursor-default" : "hover:bg-muted/50"
                          )}
                          onClick={() => {
                            if (!inCart) {
                              addToCart(item);
                              setTestSearch("");
                              testSearchInputRef.current?.focus();
                            }
                          }}
                          disabled={inCart}
                        >
                          <div className="flex items-center gap-2">
                            {item.type === "profile" ? (
                              <Package className="w-4 h-4 text-primary" />
                            ) : (
                              <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium">{item.name}</p>
                                {item.type === "profile" && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                    Perfil · {item.templateCount} examenes
                                  </span>
                                )}
                              </div>
                              {item.type === "exam" && (
                                <p className="text-xs text-muted-foreground">{item.category}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mono">${item.price.toFixed(2)}</span>
                            {!inCart && <Plus className="w-4 h-4 text-primary" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="w-full space-y-4 h-full flex flex-col">
                <Label className="text-sm font-semibold">Resumen de la orden</Label>
                <div className="h-auto min-h-52 rounded-lg border border-border lg:h-full">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No has seleccionado ningun examen
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">
                              Examen
                            </th>
                            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">
                              Categoria
                            </th>
                            <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">
                              Precio
                            </th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                      </table>
                      <div className="max-h-52 overflow-y-auto">
                        <table className="w-full">
                          <tbody className="divide-y divide-border">
                            {cart.map((item, index) => (
                              <tr
                                key={`${item.template_id || item.profileId}-${index}`}
                                className={cn(
                                  item.isProfileHeader && "bg-primary/5",
                                  item.parentProfileId && "bg-muted/10"
                                )}
                              >
                                <td className="px-3 py-2 text-sm font-medium">
                                  <div className="flex items-center gap-1.5">
                                    {item.parentProfileId && (
                                      <span className="text-muted-foreground">└</span>
                                    )}
                                    {item.isProfileHeader && (
                                      <Package className="w-3.5 h-3.5 text-primary" />
                                    )}
                                    {item.test_name}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                  {item.category}
                                </td>
                                <td className="px-3 py-2 text-sm font-semibold mono text-right">
                                  {item.price > 0
                                    ? `$${item.price.toFixed(2)}`
                                    : item.parentProfileId
                                      ? ""
                                      : "$0.00"}
                                </td>
                                <td className="px-2 py-2">
                                  {!item.parentProfileId && (
                                    <button
                                      onClick={() => handleRemoveCartItem(item)}
                                      className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-3 py-2.5 bg-muted/20 border-t border-border space-y-1 mt-auto">
                        {canExemptOrder && (
                          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/80 px-3 py-2">
                            <div className="space-y-1">
                              <Label htmlFor="order-exempt-switch" className="text-sm font-semibold cursor-pointer">
                                Exonerar Orden
                              </Label>
                            </div>
                            <Switch
                              id="order-exempt-switch"
                              checked={isExempted}
                              onCheckedChange={setIsExempted}
                              aria-label="Exonerar orden"
                            />
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Total USD</span>
                            {isExempted && <Badge variant="secondary">Exonerado</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            {isExempted && (
                              <span className="text-sm mono text-muted-foreground line-through">
                                ${total.toFixed(2)}
                              </span>
                            )}
                            <span className="text-base font-bold mono text-primary">
                              ${effectiveTotals.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {effectiveTotals.totalBs !== null && currentRate && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Total BS (Tasa: {currentRate.toFixed(2)})
                            </span>
                            <div className="flex items-center gap-2">
                              {isExempted && totalBs !== null && (
                                <span className="text-xs mono text-muted-foreground line-through">
                                  Bs. {totalBs.toFixed(2)}
                                </span>
                              )}
                              <span className="text-sm font-bold mono text-foreground">
                                Bs. {effectiveTotals.totalBs.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
              <Button
                variant="outline"
                onClick={() => {
                  resetDialog();
                  onOpenChange(false);
                }}
              >
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

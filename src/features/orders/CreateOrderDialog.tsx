import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, X, UserPlus, ShoppingCart, Printer, Package, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { cn } from "@/lib/utils";
import { OrderReceiptPDF } from "@/lib/orderReceiptPDF";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { NewPatientDialog } from "../patients/NewPatientDialog";
import type { PatientFormData } from "../patients/schemas";
import { useCreatePatient, usePatientSearch } from "../patients/usePatients";
import { useOrderProfiles, useOrderTemplates } from "../tests/useTestTemplates";
import { useCreateOrder } from "./useOrders";
import {
  addSearchItemToCart,
  buildOrderReceiptData,
  buildSearchItems,
  buildSelectedPatientSummary,
  calculateCartTotal,
  calculateCartTotalBs,
  CartItem,
  filterSearchItems,
  removeCartItem,
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
  const { orgId } = useCurrentOrgContext();
  const createOrder = useCreateOrder();
  const queryClient = useQueryClient();
  const { data: exchangeRateData } = useExchangeRate(orgId);
  const currentRate = exchangeRateData?.rate ? Number(exchangeRateData.rate) : null;

  const [patientSearch, setPatientSearch] = useState("");
  const debouncedSearch = useDebounce(patientSearch, 500);
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [testSearch, setTestSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [receiptData, setReceiptData] = useState<ReturnType<typeof buildOrderReceiptData> | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);

  const { data: patients = [], isFetching: searchingPatients } = usePatientSearch(debouncedSearch);
  const { data: templates = [] } = useOrderTemplates();
  const { data: examProfiles = [] } = useOrderProfiles();

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
    if (!selectedPatient || !orgId || cart.length === 0) {
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        orgId,
        patientId: selectedPatient.id,
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
        totalBs,
      });

      toast.success("Orden creada correctamente");

      const generatedReceiptData = buildOrderReceiptData({
        orderId: String((order as { orderId?: string }).orderId),
        order_seq: (order as { order_seq?: number | null }).order_seq,
        selectedPatient,
        cart,
        total,
        accessPin: (order as { access_pin?: string | null }).access_pin,
        exchangeRate: currentRate,
        totalBs,
      });

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

  return (
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
        "max-h-[70vh] overflow-y-auto w-[70vw]",
        receiptData ? "sm:max-w-4xl" : "sm:max-w-5xl h-[90vh]",
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
            <div className="h-[65vh] w-full border border-border rounded-lg overflow-hidden">
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

            <div className="flex flex-col lg:flex-row gap-4 mb-2 md:h-96">
              <div className="w-full space-y-4 h-full flex flex-col">
                <Label className="text-sm font-semibold">2. Selecciona los examenes a realizar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar examen..."
                    value={testSearch}
                    onChange={(event) => setTestSearch(event.target.value)}
                  />
                </div>

                <div className="border border-border rounded-lg overflow-y-auto divide-y divide-border">
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
                <div className="border border-border rounded-lg h-full">
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
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold">Total USD</span>
                          <span className="text-base font-bold mono text-primary">
                            ${total.toFixed(2)}
                          </span>
                        </div>
                        {totalBs !== null && currentRate && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Total BS (Tasa: {currentRate.toFixed(2)})
                            </span>
                            <span className="text-sm font-bold mono text-foreground">
                              Bs. {totalBs.toFixed(2)}
                            </span>
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

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  resetDialog();
                  onOpenChange(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateOrder}
                disabled={!selectedPatient || cart.length === 0 || createOrder.isPending}
              >
                {createOrder.isPending ? "Cargando..." : "Crear Orden"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

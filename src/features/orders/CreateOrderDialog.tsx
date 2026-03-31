import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInYears } from "date-fns";
import { Search, Plus, X, UserPlus, ShoppingCart, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { OrderReceiptPDF } from "@/lib/orderReceiptPDF";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { useCreateOrder, useProfile } from "./useOrders";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { Package, FlaskConical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { NewPatientDialog } from "../patients/NewPatientDialog";
import { PatientFormData } from "../patients/schemas";
import { useDebounce } from "@/hooks/useDebounce";

interface CartItem {
  template_id: string | null;
  test_name: string;
  category: string;
  price: number;
  schema;
  // Profile support
  isProfileHeader?: boolean;
  profileId?: string; // unique key for grouping
  parentProfileId?: string; // links child to header
}

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  labData?;
}

export function CreateOrderDialog({ open, onOpenChange, onSuccess, labData }: CreateOrderDialogProps) {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;
  const createOrder = useCreateOrder();
  const queryClient = useQueryClient();
  const { data: exchangeRateData } = useExchangeRate(orgId);
  const currentRate = exchangeRateData?.rate ? Number(exchangeRateData.rate) : null;

  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const debouncedSearch = useDebounce(patientSearch, 500);


  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);

  // Test search & cart
  const [testSearch, setTestSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Notes
  const [notes, setNotes] = useState("");

  // Receipt state
  const [receiptData, setReceiptData] = useState<{
    orderId: string;
    orderDate: string;
    patientName: string;
    patientId: string;
    items: { test_name: string; price: number }[];
    total: number;
    accessPin?: string | null;
    exchangeRate?: number | null;
    totalBs?: number | null;
  } | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);

  // Search patients
  const { data: patients = [], isFetching: searchingPatients } = useQuery({
    queryKey: ["patient-search", debouncedSearch, orgId],
    queryFn: async () => {
      if (!patientSearch.trim() || !orgId) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("id, id_number, first_name, last_name, date_of_birth, gender, phone")
        .eq("org_id", orgId)
        .or(`id_number.ilike.%${patientSearch}%,first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!patientSearch.trim() && patientSearch.length >= 2 && !!orgId,
  });

  // Fetch test templates for this org
  const { data: templates = [] } = useQuery({
    queryKey: ["order-templates", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_test_templates_filtered")
        .select("*")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // Fetch exam profiles for this org
  const { data: examProfiles = [] } = useQuery({
    queryKey: ["order-profiles", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase)
        .from("exam_profiles")
        .select("*, profile_templates_junction(template_id, test_templates(id, name, category, base_price, schema))")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // Build unified searchable list
  type SearchItem =
    | { type: "exam"; id: string; name: string; category: string; price: number; schema: any }
    | { type: "profile"; id: string; name: string; description: string | null; price: number; templateCount: number; templates: any[] };

  const allSearchItems = useMemo((): SearchItem[] => {
    const exams: SearchItem[] = templates.map((t) => ({
      type: "exam" as const,
      id: t.id,
      name: t.name,
      category: t.category,
      price: Number(t.base_price),
      schema: t.schema,
    }));

    const profiles: SearchItem[] = examProfiles.map((p) => ({
      type: "profile" as const,
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.total_price),
      templateCount: p.profile_templates_junction?.length ?? 0,
      templates: (p.profile_templates_junction ?? []).map((j) => j.test_templates).filter(Boolean),
    }));

    return [...profiles, ...exams];
  }, [templates, examProfiles]);

  const filteredItems = useMemo(() => {
    if (!testSearch.trim()) return allSearchItems;
    const q = testSearch.toLowerCase();
    return allSearchItems.filter((item) =>
      item.name?.toLowerCase().includes(q) ||
      (item.type === "exam" && item.category?.toLowerCase().includes(q))
    );
  }, [allSearchItems, testSearch]);


  function addToCart(item: SearchItem) {
    if (item.type === "exam") {
      if (cart.some((c) => c.template_id === item.id && !c.parentProfileId)) return;
      setCart((prev) => [
        ...prev,
        {
          template_id: item.id,
          test_name: item.name,
          category: item.category,
          price: item.price,
          schema: item.schema,
        },
      ]);
    } else {
      // Profile: check if already added
      if (cart.some((c) => c.isProfileHeader && c.profileId === item.id)) return;
      const profileId = item.id;
      const headerItem: CartItem = {
        template_id: null,
        test_name: item.name,
        category: "Perfil",
        price: item.price,
        schema: null,
        isProfileHeader: true,
        profileId,
      };
      const childItems: CartItem[] = item.templates.map((tpl) => ({
        template_id: tpl.id,
        test_name: tpl.name,
        category: tpl.category,
        price: 0,
        schema: tpl.schema,
        parentProfileId: profileId,
      }));
      setCart((prev) => [...prev, headerItem, ...childItems]);
    }
  }

  function removeFromCart(item: CartItem) {
    if (item.isProfileHeader && item.profileId) {
      // Remove header + all children
      setCart((prev) => prev.filter((c) => c.profileId !== item.profileId && c.parentProfileId !== item.profileId));
    } else if (item.parentProfileId) {
      // Don't allow removing individual children of a profile
      return;
    } else {
      setCart((prev) => prev.filter((c) => c.template_id !== item.template_id || c.parentProfileId));
    }
  }

  const total = cart.reduce((sum, c) => sum + c.price, 0);
  const totalBs = currentRate ? total * currentRate : null;

  const isMobileDevice = () => typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  async function handleCreateOrder() {
    if (!selectedPatient || !orgId || cart.length === 0) return;

    try {
      const order = await createOrder.mutateAsync({
        orgId,
        patientId: selectedPatient.id,
        items: cart.map((c) => ({
          template_id: c.template_id,
          test_name: c.test_name,
          price: c.price,
          schema: c.schema,
          isProfileHeader: c.isProfileHeader,
          profileId: c.profileId,
          parentProfileId: c.parentProfileId,
        })),
        notes: notes.trim() || null,
        exchangeRate: currentRate,
        totalBs: totalBs,
      });
      toast.success("Orden Creada Correctamente");

      // Show receipt — only show items with price > 0 (hides $0 child exams)
      const receiptItems = cart.filter((c) => c.price > 0 || (!c.parentProfileId && !c.isProfileHeader));
      const generatedReceiptData = {
        orderId: order.id,
        orderDate: format(new Date(), "dd/MM/yyyy HH:mm"),
        patientName: `${selectedPatient.first_name} ${selectedPatient.last_name}`.toUpperCase(),
        patientId: selectedPatient.id_number,
        items: receiptItems.filter(c => c.price > 0).map((c) => ({ test_name: c.test_name, price: c.price })),
        total,
        accessPin: order.access_pin,
        exchangeRate: currentRate,
        totalBs: totalBs,
      };

      if (isMobileDevice()) {
        // Mobile: abrir PDF en nueva pestaña en lugar de mostrar el PDFViewer dentro del dialog
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

        // Cierra dialog y limpia estado de creación para evitar UI extra
        setReceiptData(null);
        onOpenChange(false);
      } else {
        setReceiptData(generatedReceiptData);
      }

      onSuccess?.();
    } catch (err) {
      toast.error(err.message);
    }
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

  const createMutation = useMutation({
    mutationFn: async (formData: PatientFormData) => {
      const { error } = await supabase.from("patients").insert([{
        id_number: formData.id_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        org_id: orgId!,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        occupation: formData.occupation || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient-search", patientSearch, orgId] });
      toast.success("Paciente creado correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  async function handleThermalPrint() {
    if (!receiptData) return;

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
      onOpenChange={(v) => {
        if (!v) resetDialog();
        onOpenChange(v);
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
              <DialogDescription>
                Imprima o descargue esta nota para el paciente.
              </DialogDescription>
            </DialogHeader>
            <div className="h-[65vh] w-full border border-border rounded-lg overflow-hidden">
              <PDFViewer width="100%" height="100%" showToolbar>
                <OrderReceiptPDF
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
                />
              </PDFViewer>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleThermalPrint} disabled={thermalPrinting}>
                {thermalPrinting ? "Imprimiendo..." : "Imprimir Termica"}
              </Button>
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

            {/* ── Step 1: Patient ── */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">1. Paciente</Label>

              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {selectedPatient.id_number}
                      {selectedPatient.date_of_birth &&
                        ` · ${differenceInYears(new Date(), new Date(selectedPatient.date_of_birth))} años`}
                      {selectedPatient.gender && ` · ${selectedPatient.gender}`}
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
                      placeholder="Buscar paciente por nombre o cédula…"
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        setShowQuickRegister(false);
                      }}
                    />
                  </div>

                  {patientSearch.length >= 2 && patients.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-40 overflow-y-auto">
                      {patients.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientSearch("");
                          }}
                        >
                          <p className="text-sm font-medium">
                            {p.first_name} {p.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">ID: {p.id_number}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {patientSearch.length >= 2 && patients.length === 0 && !searchingPatients && (
                    <div className="text-center py-3 space-y-2">
                      <p className="text-sm text-muted-foreground">No se encontraron pacientes con estos datos</p>
                      {!showQuickRegister && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowQuickRegister(true);
                          }}
                        >
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
                      onSubmit={(data) => createMutation.mutateAsync(data)}
                    />
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Step 2: Tests ── */}
            <div className="flex flex-col lg:flex-row gap-4 mb-2 md:h-96">

              <div className="w-full space-y-4 h-full flex flex-col">
                <Label className="text-sm font-semibold">2. Selecciona los examenes a realizar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar examen..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                  />
                </div>

                <div className="border border-border rounded-lg overflow-y-auto divide-y divide-border">
                  {filteredItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron examenes con estos datos
                    </p>
                  ) : (
                    filteredItems.map((item) => {
                      const inCart = item.type === "exam"
                        ? cart.some((c) => c.template_id === item.id && !c.parentProfileId)
                        : cart.some((c) => c.isProfileHeader && c.profileId === item.id);
                        
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          className={cn(
                            "w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors",
                            inCart
                              ? "bg-accent/40 cursor-default"
                              : "hover:bg-muted/50"
                          )}
                          onClick={() => !inCart && addToCart(item)}
                          disabled={inCart}
                        >
                          <div className="flex items-center gap-2">
                            {item.type === "profile"
                              ? <Package className="w-4 h-4 text-primary" />
                              : <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium">{item.name}</p>
                                {item.type === "profile" && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                    Perfil · {item.templateCount} exámenes
                                  </span>
                                )}
                              </div>
                              {item.type === "exam" && (
                                <p className="text-xs text-muted-foreground">{item.category}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mono">
                              ${item.price.toFixed(2)}
                            </span>
                            {!inCart && <Plus className="w-4 h-4 text-primary" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Cart ── */}
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
                            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Examen</th>
                            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Categoria</th>
                            <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">Precio</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                      </table>
                      <div className="max-h-52 overflow-y-auto">
                        <table className="w-full">
                          <tbody className="divide-y divide-border">
                            {cart.map((item, idx) => (
                              <tr key={`${item.template_id || item.profileId}-${idx}`}
                                className={cn(
                                  item.isProfileHeader && "bg-primary/5",
                                  item.parentProfileId && "bg-muted/10"
                                )}
                              >
                                <td className="px-3 py-2 text-sm font-medium">
                                  <div className="flex items-center gap-1.5">
                                    {item.parentProfileId && <span className="text-muted-foreground">└</span>}
                                    {item.isProfileHeader && <Package className="w-3.5 h-3.5 text-primary" />}
                                    {item.test_name}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">{item.category}</td>
                                <td className="px-3 py-2 text-sm font-semibold mono text-right">
                                  {item.price > 0 ? `$${item.price.toFixed(2)}` : item.parentProfileId ? "" : "$0.00"}
                                </td>
                                <td className="px-2 py-2">
                                  {!item.parentProfileId && (
                                    <button
                                      onClick={() => removeFromCart(item)}
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
                          <span className="text-base font-bold mono text-primary">${total.toFixed(2)}</span>
                        </div>
                        {totalBs !== null && currentRate && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Total BS (Tasa: {currentRate.toFixed(2)})</span>
                            <span className="text-sm font-bold mono text-foreground">Bs. {totalBs.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>


            {/* ── Notes ── */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Notas (Diagnóstico o Síntomas)</Label>
              <Textarea
                placeholder="Ingrese el diagnóstico o síntomas que presenta el paciente..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
                {createOrder.isPending ? "Cargando…" : "Crear Orden"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

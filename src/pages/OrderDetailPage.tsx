import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, differenceInYears } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrder, useOrderItems, useUpdateOrderStatus, useSaveResults } from "@/features/orders/useOrders";
import { findMatchingRange } from "@/features/tests/schemas";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ArrowLeft, Save, FileText, ClipboardCheck, FlaskConical, DollarSign, Calendar, User, Link as LinkIcon, Receipt, IdCard, Phone, Mail } from "lucide-react";
import { PDFViewer } from "@react-pdf/renderer";
import { UnifiedTestReportPDF } from "@/lib/unifiedTestReportPDF";
import { OrderReceiptPDF } from "@/lib/orderReceiptPDF";
import { toast } from "sonner";
import { Atom } from "react-loading-indicators";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canEnterResults } = usePermissions();

  const { data: order, isLoading: orderLoading } = useOrder(id || null);
  const { data: orderItems = [], isLoading: itemsLoading } = useOrderItems(id || null);
  const updateStatus = useUpdateOrderStatus();
  const saveResults = useSaveResults();

  const [resultsState, setResultsState] = useState<Record<string, any>>({});
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);

  // Load results_data into state
  useEffect(() => {
    if (orderItems.length > 0) {
      const initialState: Record<string, any> = {};
      orderItems.forEach(item => {
        if (item.results_data) {
          initialState[item.id] = typeof item.results_data === "string"
            ? JSON.parse(item.results_data)
            : JSON.parse(JSON.stringify(item.results_data));
        }
      });
      setResultsState(initialState);
      setModifiedIds(new Set());
    }
  }, [orderItems]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const orgId = profile?.org_id;

  const { data: lab } = useQuery({
    queryKey: ["lab", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orgId,
  });

  if (orderLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Atom color={lab?.primary_color || "#0ea5e9"} size="large" text="Cargando orden..." textColor={lab?.primary_color || "#0ea5e9"} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Orden no encontrada</p>
      </div>
    );
  }

  const patientInfo = {
    name: `${order.patients.first_name} ${order.patients.last_name}`.toUpperCase(),
    id: order.patients.id_number,
    date: format(new Date(order.created_at), "dd/MM/yyyy"),
    age: order.patients.date_of_birth
      ? differenceInYears(new Date(), new Date(order.patients.date_of_birth))
      : "N/A",
    gender: order.patients.gender || "N/A",
  };

  function updateFieldValue(itemId: string, sectionIdx: number, fieldIdx: number, value: string) {
    setResultsState(prev => {
      const updated = { ...prev };
      if (!updated[itemId]) return prev;

      const itemData = JSON.parse(JSON.stringify(updated[itemId]));
      itemData.sections[sectionIdx].fields[fieldIdx].value = value;
      updated[itemId] = itemData;
      return updated;
    });
    setModifiedIds(prev => new Set(prev).add(itemId));
  }

  async function handleSaveAll() {
    if (modifiedIds.size === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }

    setIsSavingAll(true);
    try {
      const promises = Array.from(modifiedIds).map(itemId => {
        return saveResults.mutateAsync({ itemId, resultsData: resultsState[itemId] });
      });
      await Promise.all(promises);
      toast.success("Resultados guardados correctamente");
      setModifiedIds(new Set());
    } catch (err) {
      toast.error(err.message || "Error al guardar los resultados");
    } finally {
      setIsSavingAll(false);
    }
  }

  function handleCompleteOrder() {
    updateStatus.mutate({ orderId: order.id, status: "completada", completed_at: new Date().toISOString() });
  }

  const handleFileUploadForOCR = async (e: React.ChangeEvent<HTMLInputElement>, categoryItems: typeof orderItems, categoryName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(categoryName);
    const toastId = toast.loading(`Analizando imagen de ${categoryName}`);

    try {
      // 1. Obtener todos los labels de los campos que queremos llenar
      const fieldsToExtract: string[] = [];
      categoryItems.forEach(item => {
        resultsState[item.id]?.sections?.forEach(section => {
          section.fields?.forEach(field => {
            if (field.type === "number" || field.type === "text") {
              fieldsToExtract.push(field.label);
            }
          });
        });
      });

      // 2. Convertir imagen a Base64
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // 3. Llamar a la Edge Function de Supabase
      const { data: extractedResults, error } = await supabase.functions.invoke('analyze-lab-report', {
        body: { image: base64Image, fields: fieldsToExtract }
      });

      if (error) {
        // Intenta leer el cuerpo del error si es posible
        const errorDetails = await error.context?.json();
        console.log("Detalles del error 400:", errorDetails);
      }

      // 4. Mapear los resultados de la IA a nuestro estado de React
      let fieldsUpdated = 0;
      categoryItems.forEach(item => {
        const itemResultsData = resultsState[item.id];
        if (!itemResultsData?.sections) return;

        itemResultsData.sections.forEach((section, sIdx) => {
          section.fields?.forEach((field, fIdx) => {
            // Si la IA devolvió un valor para este label exacto
            const aiValue = extractedResults[field.label];
            if (aiValue !== undefined && aiValue !== null) {
              updateFieldValue(item.id, sIdx, fIdx, aiValue.toString());
              fieldsUpdated++;
            }
          });
        });
      });

      if (fieldsUpdated > 0) {
        toast.success(`Se autocompletaron ${fieldsUpdated} valores. Por favor, revísalos.`, { id: toastId });
      } else {
        toast.warning("No se detectó valores coincidentes en esta imagen.", { id: toastId });
      }

    } catch (error) {
      console.error("Error con Gemini OCR:", error);
      toast.error("No se pudo procesar la imagen.", { id: toastId });
    } finally {
      setOcrLoading(null);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative pb-20">
      <PageHeader
        title={`Orden: ${order.order_seq.toString().padStart(4, '0')}`}
        description={`Fecha: ${patientInfo.date}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            {order.status === "pendiente" && (
              <Button variant="outline" size="sm" onClick={handleCompleteOrder}>
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Marcar como completada
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setUnifiedOpen(true)}>
              <FileText className="w-4 h-4 mr-2" />
              Ver Informe
            </Button>
            <Button variant="outline" size="sm" onClick={() => setReceiptOpen(true)}>
              <Receipt className="w-4 h-4 mr-2" />
              Ver Nota
            </Button>
            {canEnterResults && order.status !== "completada" && (
              <Button size="sm" onClick={handleSaveAll} disabled={isSavingAll || modifiedIds.size === 0}>
                <Save className="w-4 h-4 mr-2" />
                {isSavingAll ? "Guardando..." : "Guardar Todos"}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-[30%] space-y-6 shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos del Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paciente</p>
                    <p className="text-sm font-medium">{patientInfo.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <IdCard className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cédula</p>
                    <p className="text-sm font-medium">{patientInfo.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Edad / Género</p>
                    <p className="text-sm font-medium">{patientInfo.age} {typeof patientInfo.age === 'number' ? 'años' : ''} / {patientInfo.gender}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefono</p>
                    <p className="text-sm font-medium">{order.patients.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Correo</p>
                    <p className="text-sm font-medium">{order.patients.email}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de la Orden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total USD</p>
                    <p className="text-sm font-semibold mono">${Number(order.total_amount).toFixed(2)}</p>
                  </div>
                </div>
                {order.total_bs != null && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total BS</p>
                      <p className="text-sm font-medium mono">Bs. {Number(order.total_bs).toFixed(2)}</p>
                    </div>
                  </div>
                )}
                {order.access_pin && (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">PIN de Acceso</p>
                      <p className="text-sm font-medium mono tracking-widest">{order.access_pin}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const portalUrl = `${window.location.origin}/portal-paciente?order=${order.id}&pin=${order.access_pin}`;
                      const phoneRaw = order.patients?.phone || "";
                      const phoneDigits = phoneRaw.replace(/\D/g, "");
                      const text = encodeURIComponent(`Tus resultados están listos, los puedes ver en ${portalUrl}`);
                      const waUrl = `https://wa.me/58${phoneDigits}?text=${text}`;
                      window.open(waUrl, "_blank");
                    }}>
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Panel */}
        <div className="w-full lg:w-[70%] space-y-6">
          {itemsLoading ? (
            <div className="flex items-center justify-center h-32 border rounded-xl bg-card">
              <Atom color={lab?.primary_color} size="large" text="Cargando exámenes..." textColor={lab?.primary_color} />
            </div>
          ) : orderItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 border rounded-xl bg-card">
              <p className="text-muted-foreground text-sm">No hay exámenes en esta orden.</p>
            </div>
          ) : (
            updateStatus.isPending ? (
              <div className="flex items-center justify-center h-32 border rounded-xl bg-card">
                <Atom color={lab?.primary_color} size="large" text="Actualizando orden..." textColor={lab?.primary_color} />
              </div>
            ) : (

              (() => {
                // Filter out profile header items (they have no results to enter)
                const enterableItems = orderItems.filter((item) => !item.is_profile_header);
                const groupedItems = enterableItems.reduce((acc, item) => {
                  const cat = item.category || 'Otros';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {} as Record<string, typeof orderItems>);

                return Object.entries(groupedItems).map(([category, itemsInCategory]) => {
                  const isCategoryModified = itemsInCategory.some(item => modifiedIds.has(item.id));
                  const allResultsEntered = itemsInCategory.every(item => {
                    const data = resultsState[item.id];
                    return data?.sections?.some((s) => s.fields?.some((f) => f.value && f.value !== ""));
                  });
                  const anyResultsEntered = itemsInCategory.some(item => {
                    const data = resultsState[item.id];
                    return data?.sections?.some((s) => s.fields?.some((f) => f.value && f.value !== ""));
                  });

                  return (
                    <Card key={category} className={isCategoryModified ? "border-primary/50 shadow-sm" : ""}>
                      <CardHeader className="py-3 px-4 bg-muted/30 border-b flex flex-row items-center justify-between pointer-events-auto">
                        <div className="flex items-center gap-2">
                          <FlaskConical className="w-4 h-4 text-primary" />
                          <CardTitle className="text-sm font-semibold">{category}</CardTitle>
                          {isCategoryModified && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] uppercase font-bold px-1.5 py-0">Modificado</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {allResultsEntered ? (
                            <span className="text-xs font-medium text-success flex items-center"><ClipboardCheck className="w-3.5 h-3.5 mr-1" /> Completado</span>
                          ) : anyResultsEntered ? (
                            <span className="text-xs font-medium text-amber-500 flex items-center">En Progreso</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pendiente</span>
                          )}
                          {!allResultsEntered && canEnterResults && order.status !== "completada" && (
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleFileUploadForOCR(e, itemsInCategory, category)}
                                disabled={ocrLoading === category}
                              />
                              <Button variant="outline" size="sm" className="h-7 text-xs px-2 pointer-events-none" disabled={ocrLoading === category}>
                                {ocrLoading === category ? (
                                  <span className="animate-pulse">Escaneando...</span>
                                ) : (
                                  <>
                                    <FileText className="w-3 h-3 mr-1.5" />
                                    Autocompletar
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 divide-y divide-border">
                        {itemsInCategory.map((item) => {
                          const itemResultsData = resultsState[item.id];
                          const readOnly = order.status === "completada" || !canEnterResults;

                          return (
                            <div key={item.id} className="p-4">

                              {itemResultsData ? (
                                <div className="space-y-6">
                                  {itemResultsData.sections?.map((section, sIdx: number) => (
                                    <div key={section.id || sIdx} className="space-y-3">
                                      <h4 className="text-[13px] font-semibold text-foreground border-b border-border pb-1">
                                        {section.name}
                                      </h4>
                                      <div className="space-y-3">
                                        {section.fields?.map((field, fIdx: number) => (
                                          <div
                                            key={field.id || fIdx}
                                            className="grid grid-cols-12 gap-3 items-center"
                                          >
                                            <Label className="col-span-12 sm:col-span-4 text-xs sm:text-sm">
                                              {field.label}
                                              {field.unit && (
                                                <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">
                                                  ({field.unit})
                                                </span>
                                              )}
                                            </Label>
                                            <div className="col-span-12 sm:col-span-5">
                                              {field.type === "select" ? (
                                                <Select
                                                  value={field.value || ""}
                                                  onValueChange={(val) =>
                                                    updateFieldValue(item.id, sIdx, fIdx, val)
                                                  }
                                                  disabled={readOnly}
                                                >
                                                  <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue placeholder="Seleccionar…" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {field.options?.map((opt: string) => (
                                                      <SelectItem key={opt} value={opt}>
                                                        {opt}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              ) : (
                                                <Input
                                                  className="h-8 text-sm"
                                                  type={field.type === "number" ? "number" : "text"}
                                                  value={field.value || ""}
                                                  onChange={(e) =>
                                                    updateFieldValue(item.id, sIdx, fIdx, e.target.value)
                                                  }
                                                  disabled={readOnly}
                                                  placeholder={
                                                    field.type === "number"
                                                      ? "Ingresar valor"
                                                      : "Ingresar resultado"
                                                  }
                                                />
                                              )}
                                            </div>
                                            <div className="col-span-12 sm:col-span-3 text-[10px] sm:text-xs text-muted-foreground">
                                              {(() => {
                                                const matched = findMatchingRange(
                                                  field.reference_ranges,
                                                  patientInfo.gender.toLowerCase(),
                                                  typeof patientInfo.age === 'number' ? patientInfo.age : parseInt(patientInfo.age, 10) || undefined
                                                );
                                                if (matched) return <span>Ref: {matched.min_value} - {matched.max_value}</span>;
                                                if (field.range) return <span>Ref: {field.range}</span>;
                                                return null;
                                              })()}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  Estructura de resultados no disponible.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                });
              }))()
          )}
        </div>
      </div>

      {/* Floating Action Bar for Mobile */}
      {modifiedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-card border border-border/50 shadow-xl rounded-full px-4 py-2 flex items-center gap-4">
            <span className="text-sm font-medium whitespace-nowrap hidden sm:inline-block">
              {modifiedIds.size} {modifiedIds.size === 1 ? "cambio" : "cambios"} sin guardar
            </span>
            <span className="text-sm font-medium whitespace-nowrap sm:hidden">
              {modifiedIds.size} cambios
            </span>
            <Button size="sm" className="rounded-full shadow-md" onClick={handleSaveAll} disabled={isSavingAll}>
              <Save className="w-4 h-4 mr-1.5" />
              {isSavingAll ? "Guardando..." : "Guardar Todo"}
            </Button>
          </div>
        </div>
      )}

      {/* Unified Report Dialog */}
      <Dialog open={unifiedOpen} onOpenChange={setUnifiedOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col w-[95vw]">
          <DialogHeader>
            <DialogTitle>Informe de Resultados</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-md border bg-muted">
            {orderItems.length > 0 ? (
              <PDFViewer width="100%" height="100%" className="border-none">
                <UnifiedTestReportPDF
                  orden={order}
                  orderItems={orderItems}
                  patientData={{
                    ...patientInfo,
                    age: `${patientInfo.age} Años`
                  }}
                  labData={{
                    name: lab?.name || "Laboratorio",
                    address: lab?.address || "",
                    phone: lab?.phone || "",
                    email: lab?.email || "",
                    logo: lab?.logo_url || null,
                    primary_color: lab?.primary_color || "#0ea5e9",
                    secondary_color: lab?.secondary_color || "#0ea5e9",
                  }}
                />
              </PDFViewer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Cargando datos del reporte...</p>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setUnifiedOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt PDF Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col w-[95vw]">
          <DialogHeader>
            <DialogTitle>Nota de Entrega</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-md border bg-muted">
            {orderItems.length > 0 ? (
              <PDFViewer width="100%" height="100%" className="border-none">
                <OrderThermalReceiptPDF
                  orderId={order.id}
                  orderDate={format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                  patientName={patientInfo.name}
                  patientId={patientInfo.id}
                  items={orderItems.filter((i) => Number(i.price_at_order) > 0).map(i => ({ test_name: i.test_name, price: Number(i.price_at_order) }))}
                  total={Number(order.total_amount)}
                  accessPin={order.access_pin}
                  portalUrl={`${window.location.origin}/portal-paciente`}
                  exchangeRate={order.exchange_rate ? Number(order.exchange_rate) : null}
                  totalBs={order.total_bs ? Number(order.total_bs) : null}
                  labData={{
                    name: lab?.name || "Laboratorio",
                    address: lab?.address || "",
                    phone: lab?.phone || "",
                    email: lab?.email || "",
                    logo: lab?.logo_url || null,
                    primary_color: lab?.primary_color || "#4f46e5",
                  }}
                />
              </PDFViewer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Cargando datos...</p>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setReceiptOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

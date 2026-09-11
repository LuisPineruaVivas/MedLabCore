import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { ArrowLeft, ClipboardCheck, FileText, Receipt, Save } from "lucide-react";
import { Atom } from "react-loading-indicators";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOrderResultsEditor } from "@/features/orders/useOrderResultsEditor";
import { useOrder, useOrderItems, useSaveResults, useUpdateOrderStatus } from "@/features/orders/useOrders";
import { OrderMobileSaveBar, OrderResultsPanel, OrderSidebar, buildLabData } from "@/features/orders/OrderDetailSections";
import { AttendanceCertificatePreviewDialog, ReceiptPreviewDialog, ReportPreviewDialog } from "@/features/orders/OrderDetailDialogs";
import { applyOcrResultsToState, buildOrderPatientInfo, buildThermalReceiptData, canApproveAndSignOrder, collectOcrFieldLabels, isMobileDevice } from "@/features/orders/orderDetailUtils";
import { useDepartmentOrder } from "@/features/tests/useTestTemplates";
import { getReportComponent } from "@/lib/orderReportDispatcher";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { LetterHeadPDF } from "@/lib/letterhead";
import { LetterHeadPreviewDialog } from "@/features/orders/LetterHeadDialog";
import { AttendanceCertificatePDF } from "@/lib/constanciaPDF";
import { CompanionAttendanceCertificatePDF } from "@/lib/constanciaAcomPDF";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization, role, profile, permissions } = useCurrentOrgContext();
  const { data: order, isLoading: orderLoading } = useOrder(id || null);
  const { data: orderItemsData, isLoading: itemsLoading } = useOrderItems(id || null);
  const { data: departmentOrder = [] } = useDepartmentOrder();
  const updateStatus = useUpdateOrderStatus();
  const saveResults = useSaveResults();
  const orderItems = useMemo(() => orderItemsData ?? [], [orderItemsData]);
  const {
    resultsState,
    modifiedIds,
    groupedItems,
    updateFieldValue,
    appendTextOption,
    resetModified,
  } = useOrderResultsEditor(orderItems);

  const [isSavingAll, setIsSavingAll] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reportItemSelectionOpen, setReportItemSelectionOpen] = useState(false);
  const [selectedReportItemIds, setSelectedReportItemIds] = useState<Set<string>>(new Set());
  const [previewReportItems, setPreviewReportItems] = useState<unknown[]>([]);
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [thermalPaperOpen, setThermalPaperOpen] = useState(false);
  const [thermalPaperMm, setThermalPaperMm] = useState<"58" | "80">("58");
  const [letterHeadOpen, setLetterHeadOpen] = useState(false);
  const [attendanceCertificateOpen, setAttendanceCertificateOpen] = useState(false);
  const [companionCertificateFormOpen, setCompanionCertificateFormOpen] = useState(false);
  const [companionCertificateOpen, setCompanionCertificateOpen] = useState(false);
  const [companionName, setCompanionName] = useState("");
  const [companionDocumentId, setCompanionDocumentId] = useState("");

  const labData = useMemo(() => buildLabData(organization), [organization]);
  const canEnterResults = permissions.canEnterResults;
  const canViewOrderDocuments = role !== "lab_affiliate";
  const orderItemsTyped = useMemo(
    () => orderItems as Array<{ id: string | number; test_name?: string; name?: string }>,
    [orderItems]
  );
  const allReportItemIds = useMemo(() => orderItemsTyped.map((item) => String(item.id)), [orderItemsTyped]);
  const selectedReportItems = useMemo(
    () => orderItemsTyped.filter((item) => selectedReportItemIds.has(String(item.id))),
    [orderItemsTyped, selectedReportItemIds]
  );
  const allItemsSelected = allReportItemIds.length > 0 && selectedReportItemIds.size === allReportItemIds.length;

  if (orderLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Atom color={labData.primary_color} size="large" text="Cargando orden..." textColor={labData.primary_color} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Orden no encontrada</p>
      </div>
    );
  }

  const patientInfo = buildOrderPatientInfo(order);

  const thermalReceiptData: ThermalReceiptData = buildThermalReceiptData(
    order,
    orderItems,
    patientInfo,
    {
      ...labData,
      primary_color: organization?.primary_color || "#4f46e5",
    },
    window.location.origin
  );

  async function handleSaveAll() {
    if (modifiedIds.size === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }

    setIsSavingAll(true);
    try {
      await Promise.all(
        Array.from(modifiedIds).map((itemId) =>
          saveResults.mutateAsync({
            itemId,
            orderId: order.id,
            orgId: order.org_id,
            resultsData: resultsState[itemId] as unknown as Json,
          })
        )
      );
      toast.success("Resultados guardados correctamente");
      resetModified();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "No se pudieron guardar los resultados"));
    } finally {
      setIsSavingAll(false);
    }
  }

  function handleMarkReadyForApproval() {
    updateStatus.mutate({
      orderId: order.id,
      orgId: order.org_id,
      status: "por_aprobar",
    });
  }

  function handleApproveAndSign() {
    if (!canApproveAndSignOrder(profile)) {
      toast.error("Primero debes cargar tu firma o sello en Configuracion de Perfil.");
      navigate("/settings");
      return;
    }

    updateStatus.mutate({
      orderId: order.id,
      orgId: order.org_id,
      status: "completada",
      completed_at: new Date().toISOString(),
      firma_url: profile?.firma_url || null,
      sello_url: profile?.sello_url || null,
    });
  }

  const primaryStatusAction =
    (role === "secretary" || role === "lab_admin" )&& order.status === "pendiente"
      ? {
          label: "Marcar por aprobar",
          onClick: handleMarkReadyForApproval,
        }
      : role === "bioanalyst" && order.status === "pendiente"
        ? {
            label: "Marcar por aprobar",
            onClick: handleMarkReadyForApproval,
          }
        : role === "bioanalyst" && order.status === "por_aprobar"
          ? {
              label: "Aprobar y Firmar",
              onClick: handleApproveAndSign,
            }
          : null;


  function openReportItemSelection() {
    if (orderItems.length === 0) {
      toast.error("No hay exámenes disponibles para imprimir.");
      return;
    }

    setSelectedReportItemIds(new Set(allReportItemIds));
    setReportItemSelectionOpen(true);
  }

  async function handleConfirmReportSelection() {
    if (selectedReportItemIds.size === 0) {
      toast.error("Selecciona al menos un examen para generar el informe.");
      return;
    }

    setReportItemSelectionOpen(false);

    if (isMobileDevice()) {
      setReportLoading(true);
      try {
        const ReportComponent = getReportComponent(organization?.report_template);
        const reportBlob = await pdf(
          <ReportComponent
            orden={order}
            orderItems={selectedReportItems as never}
            departmentOrder={departmentOrder}
            patientData={{ ...patientInfo, age: `${patientInfo.age} Años` }}
            labData={labData}
          />
        ).toBlob();

        const url = URL.createObjectURL(reportBlob);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Error generando reporte móvil:", error);
        toast.error("No se pudo abrir el informe en el móvil. Intenta descargarlo.");
      } finally {
        setReportLoading(false);
      }
      return;
    }

    setPreviewReportItems(selectedReportItems);
    setUnifiedOpen(true);
  }

  function toggleReportItemSelection(itemId: string) {
    setSelectedReportItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function toggleSelectAllReportItems() {
    setSelectedReportItemIds((prev) => {
      if (prev.size === allReportItemIds.length) {
        return new Set();
      }
      return new Set(allReportItemIds);
    });
  }

  async function handleViewReport() {
    openReportItemSelection();
  }

  async function handleViewLetterhead() {
    if (isMobileDevice()) {
      try {
        const blob = await pdf(<LetterHeadPDF orden={order as never} patientData={{ ...patientInfo, age: `${patientInfo.age} Años` }} />).toBlob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Error abriendo membrete móvil:", error);
        toast.error("No se pudo abrir el membrete en el móvil. Intenta descargarlo.");
      }
    } else {
      setLetterHeadOpen(true);
    }
    
  }

  async function handleViewReceipt() {
    if (isMobileDevice()) {
      setReceiptLoading(true);
      try {
        const blob = await pdf(<OrderThermalReceiptPDF {...thermalReceiptData} />).toBlob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Error abriendo recibo móvil:", error);
        toast.error("No se pudo abrir la nota en el móvil. Intenta descargarla.");
      } finally {
        setReceiptLoading(false);
      }
      return;
    }

    setReceiptOpen(true);
  }

  async function handleViewAttendanceCertificate() {
    if (isMobileDevice()) {
      try {
        const blob = await pdf(<AttendanceCertificatePDF order={order} labData={labData} />).toBlob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Error abriendo constancia mÃ³vil:", error);
        toast.error("No se pudo abrir la constancia en el mÃ³vil. Intenta descargarla.");
      }
      return;
    }

    setAttendanceCertificateOpen(true);
  }

  function handleOpenCompanionCertificateForm() {
    setCompanionCertificateFormOpen(true);
  }

  async function handleConfirmCompanionCertificate() {
    const trimmedName = companionName.trim();
    const trimmedDocumentId = companionDocumentId.trim();

    if (!trimmedName || !trimmedDocumentId) {
      toast.error("Debes ingresar el nombre y la cédula del acompañante.");
      return;
    }

    setCompanionCertificateFormOpen(false);

    if (isMobileDevice()) {
      try {
        const blob = await pdf(
          <CompanionAttendanceCertificatePDF
            order={order}
            labData={labData}
            subjectName={trimmedName}
            subjectDocumentId={trimmedDocumentId}
          />
        ).toBlob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Error abriendo constancia de acompanante movil:", error);
        toast.error("No se pudo abrir la constancia del acompañante en el móvil. Intenta descargarla.");
      }
      return;
    }

    setCompanionCertificateOpen(true);
  }

  async function handleFileUploadForOCR(
    event: React.ChangeEvent<HTMLInputElement>,
    categoryItems: typeof orderItems,
    categoryName: string
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setOcrLoading(categoryName);
    const toastId = toast.loading(`Analizando imagen de ${categoryName}`);

    try {
      const fieldsToExtract = collectOcrFieldLabels(categoryItems, resultsState);

      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const { data: extractedResults, error } = await supabase.functions.invoke("analyze-lab-report", {
        body: { image: base64Image, fields: fieldsToExtract },
      });

      if (error) {
        const errorDetails = await error.context?.json();
        console.log("Detalles del error OCR:", errorDetails);
      }

      const fieldsUpdated = applyOcrResultsToState(categoryItems, resultsState, extractedResults, updateFieldValue);

      if (fieldsUpdated > 0) {
        toast.success(`Se autocompletaron ${fieldsUpdated} valores. Por favor, revísalos.`, { id: toastId });
      } else {
        toast.warning("No se detectó valores coincidentes en esta imagen.", { id: toastId });
      }
    } catch (error) {
      console.error("Error con OCR:", error);
      toast.error("No se pudo procesar la imagen.", { id: toastId });
    } finally {
      setOcrLoading(null);
      event.target.value = "";
    }
  }

  async function handlePrintThermal(paperMm: 58 | 80) {
    setThermalPrinting(true);
    try {
      await printThermalReceipt(thermalReceiptData, paperMm);
      toast.success("Recibo enviado a la impresora térmica");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo imprimir el recibo");
    } finally {
      setThermalPrinting(false);
    }
  }
    function handleSharePortalLink() {
    // 1. Obtener la cédula/DNI del paciente desde los datos de la orden
    const patientDni = order.patients?.id_number || order.patients?.id_number || "";
    
    if (!patientDni) {
      toast.error("El paciente no tiene un documento de identidad registrado.");
      return;
    }

    // 2. Construir la URL del portal incluyendo el parámetro 'dni' para el auto-login
    const portalUrl = `${window.location.origin}/portal-paciente?org=${order.org_id}&pin=${order.access_pin}&dni=${encodeURIComponent(patientDni)}`;
    
    // 3. Obtener y limpiar el número telefónico
    const phoneDigits = (order.patients?.phone || "").replace(/\D/g, "");
    if (!phoneDigits) {
      toast.error("El paciente no tiene un número de teléfono registrado.");
      return;
    }
    
    // 4. Crear el mensaje y abrir WhatsApp
    const text = encodeURIComponent(`Tus resultados están listos, los puedes ver de inmediato en el siguiente enlace: ${portalUrl}`);
    window.open(`https://wa.me/58${phoneDigits}?text=${text}`, "_blank");
  }

  function handleSharePdfDirectLink() {
      const patientDni = order.patients?.id_number || order.patients?.id_number || "";
      
      // Apunta directamente a la nueva ruta /informe-pdf
      const pdfUrl = `${window.location.origin}/informe-pdf?org=${order.org_id}&pin=${order.access_pin}&dni=${encodeURIComponent(patientDni)}`;
      
      const phoneDigits = (order.patients?.phone || "").replace(/\D/g, "");
      const text = encodeURIComponent(`Hola, puedes ver e imprimir tu informe de resultados directamente en este enlace: ${pdfUrl}`);

      window.open(`https://wa.me/58${phoneDigits}?text=${text}`, "_blank");
    }

  return (
    <div className="relative space-y-6 animate-fade-in pb-20">
      <PageHeader
        title={`Orden: ${order.order_seq.toString().padStart(4, "0")}`}
        description={`Fecha: ${patientInfo.date}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            {primaryStatusAction && (
              <Button variant="outline" size="sm" onClick={primaryStatusAction.onClick} disabled={updateStatus.isPending}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                {primaryStatusAction.label}
              </Button>
            )}
            {canViewOrderDocuments && (
              <Button variant="outline" size="sm" onClick={handleViewReport} disabled={reportLoading}>
                <FileText className="mr-2 h-4 w-4" />
                {reportLoading ? "Generando..." : "Ver Informe"}
              </Button>
            )}
            {canViewOrderDocuments && (
              <Button variant="outline" size="sm" onClick={handleViewReceipt} disabled={receiptLoading}>
                <Receipt className="mr-2 h-4 w-4" />
                {receiptLoading ? "Generando..." : "Ver Nota"}
              </Button>
            )}

            {canEnterResults && order.status !== "completada" && (
              <Button size="sm" onClick={handleSaveAll} disabled={isSavingAll || modifiedIds.size === 0}>
                <Save className="mr-2 h-4 w-4" />
                {isSavingAll ? "Guardando..." : "Guardar Todos"}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <OrderSidebar
          order={order}
          patientInfo={patientInfo}
          onSharePortalLink={handleSharePortalLink}
          onSharePdfDirectLink={handleSharePdfDirectLink}
          onGenerateCertificate={handleViewAttendanceCertificate}
          onGenerateCompanionCertificate={handleOpenCompanionCertificateForm}
          onGenerateLetterHead={handleViewLetterhead}
          showDocumentActions={canViewOrderDocuments}
          showSharePortalAction={canViewOrderDocuments}
        />

        <div className="w-full space-y-6 lg:w-[70%]">
          {itemsLoading ? (
            <Card className="flex h-32 items-center justify-center rounded-xl border bg-card">
              <Atom color={labData.primary_color} size="large" text="Cargando exámenes..." textColor={labData.primary_color} />
            </Card>
          ) : orderItems.length === 0 ? (
            <Card className="flex h-32 items-center justify-center rounded-xl border bg-card">
              <p className="text-sm text-muted-foreground">No hay exámenes en esta orden.</p>
            </Card>
          ) : updateStatus.isPending ? (
            <Card className="flex h-32 items-center justify-center rounded-xl border bg-card">
              <Atom color={labData.primary_color} size="large" text="Actualizando orden..." textColor={labData.primary_color} />
            </Card>
          ) : (
            <OrderResultsPanel
              groupedItems={groupedItems}
              modifiedIds={modifiedIds}
              resultsState={resultsState}
              patientInfo={patientInfo}
              canEnterResults={
                 (role === "secretary" || role === "lab_admin" )&& order.status === "pendiente"
                      ? canEnterResults
                      : role === "bioanalyst" && order.status === "pendiente"
                        ? canEnterResults
                        : role === "bioanalyst" && order.status === "por_aprobar"
                          ? canEnterResults
                          : null
              }
              orderStatus={order.status}
              ocrLoading={ocrLoading}
              updateFieldValue={updateFieldValue}
              appendTextOption={appendTextOption}
              handleFileUploadForOCR={handleFileUploadForOCR}
            />
          )}
        </div>
      </div>

      <OrderMobileSaveBar modifiedCount={modifiedIds.size} isSavingAll={isSavingAll} onSaveAll={handleSaveAll} />

      <Dialog open={reportItemSelectionOpen} onOpenChange={setReportItemSelectionOpen}>
        <DialogContent className="sm:max-w-3xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Seleccionar exámenes para el informe</DialogTitle>
            <DialogDescription>
              Elige los exámenes que quieres incluir en el informe. Puedes seleccionar todos o marcar los que ya estén completos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm transition hover:bg-muted">
              <input
                type="checkbox"
                checked={allItemsSelected}
                onChange={toggleSelectAllReportItems}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="font-medium">Imprimir todos</span>
            </label>
            <div className="grid gap-2 max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-background p-3">
              {orderItemsTyped.map((item) => {
                const itemId = String(item.id);
                const itemLabel = item.test_name || item.name || itemId;
                return (
                  <label key={itemId} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 p-3 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selectedReportItemIds.has(itemId)}
                      onChange={() => toggleReportItemSelection(itemId)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>{itemLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setReportItemSelectionOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmReportSelection} disabled={selectedReportItemIds.size === 0}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={companionCertificateFormOpen}
        onOpenChange={(open) => {
          setCompanionCertificateFormOpen(open);
          if (!open) {
            setCompanionCertificateOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Datos del acompañante</DialogTitle>
            <DialogDescription>
              Ingresa el nombre y la cédula que deben aparecer en la constancia del acompañante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="companion-name">Nombre completo</Label>
              <Input
                id="companion-name"
                value={companionName}
                onChange={(event) => setCompanionName(event.target.value)}
                placeholder="Ej. Maria Perez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companion-document">Cédula</Label>
              <Input
                id="companion-document"
                value={companionDocumentId}
                onChange={(event) => setCompanionDocumentId(event.target.value)}
                placeholder="Ej. 12345678"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanionCertificateFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCompanionCertificate}>Generar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportPreviewDialog
        open={unifiedOpen}
        onOpenChange={setUnifiedOpen}
        order={order}
        orderItems={previewReportItems}
        departmentOrder={departmentOrder}
        reportTemplate={organization?.report_template}
        patientData={patientInfo}
        labData={labData}
      />

      <ReceiptPreviewDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        orderItemsCount={orderItems.length}
        thermalReceiptData={thermalReceiptData}
        thermalPrinting={thermalPrinting}
        onPrintThermal={handlePrintThermal}
        thermalPaperOpen={thermalPaperOpen}
        setThermalPaperOpen={setThermalPaperOpen}
        thermalPaperMm={thermalPaperMm}
        setThermalPaperMm={setThermalPaperMm}
      />

      <LetterHeadPreviewDialog
        open={letterHeadOpen}
        onOpenChange={setLetterHeadOpen}
        order={order}
        patientData={patientInfo}
      />

      <AttendanceCertificatePreviewDialog
        open={attendanceCertificateOpen}
        onOpenChange={setAttendanceCertificateOpen}
        order={order}
        labData={labData}
        subjectName={patientInfo.name}
        subjectDocumentId={patientInfo.id}
        title="Constancia de Asistencia"
        description="Revisa la constancia antes de imprimir"
        type="patient"
      />

      <AttendanceCertificatePreviewDialog
        open={companionCertificateOpen}
        onOpenChange={setCompanionCertificateOpen}
        order={order}
        labData={labData}
        subjectName={companionName}
        subjectDocumentId={companionDocumentId}
        title="Constancia de Acompañante"
        description="Revisa la constancia del acompañante antes de imprimir"
        type="companion"
      />


    </div>
  );
}

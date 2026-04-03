import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { ArrowLeft, ClipboardCheck, FileText, Receipt, Save } from "lucide-react";
import { Atom } from "react-loading-indicators";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOrderResultsEditor } from "@/features/orders/useOrderResultsEditor";
import { useOrder, useOrderItems, useSaveResults, useUpdateOrderStatus } from "@/features/orders/useOrders";
import { OrderMobileSaveBar, OrderResultsPanel, OrderSidebar, buildLabData } from "@/features/orders/OrderDetailSections";
import { ReceiptPreviewDialog, ReportPreviewDialog } from "@/features/orders/OrderDetailDialogs";
import { applyOcrResultsToState, buildOrderPatientInfo, buildThermalReceiptData, collectOcrFieldLabels, isMobileDevice } from "@/features/orders/orderDetailUtils";
import { UnifiedTestReportPDF } from "@/lib/unifiedTestReportPDF";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { getUserFacingErrorMessage } from "@/lib/errors";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEnterResults } = usePermissions();
  const { organization } = useCurrentOrgContext();
  const { data: order, isLoading: orderLoading } = useOrder(id || null);
  const { data: orderItems = [], isLoading: itemsLoading } = useOrderItems(id || null);
  const updateStatus = useUpdateOrderStatus();
  const saveResults = useSaveResults();
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
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);

  const labData = useMemo(() => buildLabData(organization), [organization]);

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

  function handleCompleteOrder() {
    updateStatus.mutate({
      orderId: order.id,
      orgId: order.org_id,
      status: "completada",
      completed_at: new Date().toISOString(),
    });
  }

  async function handleViewReport() {
    if (isMobileDevice()) {
      setReportLoading(true);
      try {
        const reportBlob = await pdf(
          <UnifiedTestReportPDF
            orden={order}
            orderItems={orderItems}
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

    setUnifiedOpen(true);
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

  async function handlePrintThermal() {
    setThermalPrinting(true);
    try {
      await printThermalReceipt(thermalReceiptData);
      toast.success("Recibo enviado a la impresora térmica");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo imprimir el recibo");
    } finally {
      setThermalPrinting(false);
    }
  }

  function handleSharePortalLink() {
    const portalUrl = `${window.location.origin}/portal-paciente?order=${order.id}&pin=${order.access_pin}`;
    const phoneDigits = (order.patients?.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(`Tus resultados están listos, los puedes ver en ${portalUrl}`);
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
            {order.status === "pendiente" && (
              <Button variant="outline" size="sm" onClick={handleCompleteOrder}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Marcar como completada
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleViewReport} disabled={reportLoading}>
              <FileText className="mr-2 h-4 w-4" />
              {reportLoading ? "Generando..." : "Ver Informe"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleViewReceipt} disabled={receiptLoading}>
              <Receipt className="mr-2 h-4 w-4" />
              {receiptLoading ? "Generando..." : "Ver Nota"}
            </Button>
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
        <OrderSidebar order={order} patientInfo={patientInfo} onSharePortalLink={handleSharePortalLink} />

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
              canEnterResults={canEnterResults}
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

      <ReportPreviewDialog
        open={unifiedOpen}
        onOpenChange={setUnifiedOpen}
        order={order}
        orderItems={orderItems}
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
      />
    </div>
  );
}

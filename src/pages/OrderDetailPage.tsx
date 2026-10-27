import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, FileText, Receipt, Save } from "lucide-react";
import { Atom } from "react-loading-indicators";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { ConsumptionConfirmDialog } from "@/features/erp/components/ConsumptionConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOrderResultsEditor } from "@/features/orders/useOrderResultsEditor";
import { useOrder, useOrderItems } from "@/features/orders/useOrders";
import { OrderMobileSaveBar, OrderResultsPanel, OrderSidebar, buildLabData } from "@/features/orders/OrderDetailSections";
import { AttendanceCertificatePreviewDialog, ReceiptPreviewDialog, ReportPreviewDialog } from "@/features/orders/OrderDetailDialogs";
import { CompanionCertificateFormDialog, ReportItemSelectionDialog } from "@/features/orders/OrderDocumentFormDialogs";
import { LetterHeadPreviewDialog } from "@/features/orders/LetterHeadDialog";
import { useOrderDocuments } from "@/features/orders/useOrderDocuments";
import { useOrderResultsActions } from "@/features/orders/useOrderResultsActions";
import { canEditOrderResults } from "@/features/orders/orderWorkflow";
import { useDepartmentOrder } from "@/features/tests/useTestTemplates";
import { useTestMethods } from "@/features/tests/useTestMethods";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization, role, profile, permissions } = useCurrentOrgContext();
  const { data: order, isLoading: orderLoading } = useOrder(id || null);
  const { data: orderItemsData, isLoading: itemsLoading } = useOrderItems(id || null);
  const { data: departmentOrder = [] } = useDepartmentOrder();
  const { data: testMethods = [] } = useTestMethods({ activeOnly: true });
  const { isErpEnabled } = useErpModule();
  const orderItems = useMemo(() => orderItemsData ?? [], [orderItemsData]);
  const editor = useOrderResultsEditor(orderItems);
  const labData = useMemo(() => buildLabData(organization), [organization]);

  const actions = useOrderResultsActions({ order, role, profile, isErpEnabled, editor });
  const documents = useOrderDocuments({
    order,
    orderItems,
    resultsState: editor.resultsState,
    organization,
    labData,
    departmentOrder,
  });

  const canEnterResults = permissions.canEnterResults;
  const canViewOrderDocuments = role !== "lab_affiliate";

  if (orderLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Atom color={labData.primary_color} size="large" text="Cargando orden..." textColor={labData.primary_color} />
      </div>
    );
  }

  if (!order || !documents.patientInfo || !documents.thermalReceiptData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Orden no encontrada</p>
      </div>
    );
  }

  const { patientInfo, thermalReceiptData, report, receipt, letterHead, certificates, share } = documents;
  const { primaryStatusAction } = actions;

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
              <Button variant="outline" size="sm" onClick={primaryStatusAction.onClick} disabled={actions.statusUpdating}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                {primaryStatusAction.label}
              </Button>
            )}
            {canViewOrderDocuments && (
              <Button variant="outline" size="sm" onClick={report.viewPdf} disabled={report.loading}>
                <FileText className="mr-2 h-4 w-4" />
                {report.loading ? "Generando..." : "Ver Informe"}
              </Button>
            )}
            {canViewOrderDocuments && (
              <Button variant="outline" size="sm" onClick={receipt.view} disabled={receipt.loading}>
                <Receipt className="mr-2 h-4 w-4" />
                {receipt.loading ? "Generando..." : "Ver Nota"}
              </Button>
            )}

            {canEnterResults && order.status !== "completada" && (
              <Button size="sm" onClick={actions.handleSaveAll} disabled={actions.isSavingAll || editor.modifiedIds.size === 0}>
                <Save className="mr-2 h-4 w-4" />
                {actions.isSavingAll ? "Guardando..." : "Guardar Todos"}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <OrderSidebar
          order={order}
          patientInfo={patientInfo}
          onSharePortalLink={share.portalLink}
          onSharePdfDirectLink={share.pdfLink}
          onGenerateCertificate={certificates.viewPatient}
          onGenerateCompanionCertificate={() => certificates.setCompanionFormOpen(true)}
          onGenerateLetterHead={letterHead.view}
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
          ) : actions.statusUpdating ? (
            <Card className="flex h-32 items-center justify-center rounded-xl border bg-card">
              <Atom color={labData.primary_color} size="large" text="Actualizando orden..." textColor={labData.primary_color} />
            </Card>
          ) : (
            <OrderResultsPanel
              groupedItems={editor.groupedItems}
              modifiedIds={editor.modifiedIds}
              resultsState={editor.resultsState}
              patientInfo={patientInfo}
              canEnterResults={canEditOrderResults(role, order.status, canEnterResults)}
              orderStatus={order.status}
              ocrLoading={actions.ocrLoading}
              testMethods={testMethods}
              selectedMethods={editor.methodsState}
              updateFieldValue={editor.updateFieldValue}
              appendTextOption={editor.appendTextOption}
              updateMethod={editor.updateMethod}
              updateMicroField={editor.updateMicroField}
              updateMicroExtraField={editor.updateMicroExtraField}
              updateMicroCultureMode={editor.updateMicroCultureMode}
              updateMicroGerms={editor.updateMicroGerms}
              updateAntibiogram={editor.updateAntibiogram}
              addAntibiogram={editor.addAntibiogram}
              removeAntibiogram={editor.removeAntibiogram}
              handleFileUploadForOCR={actions.handleFileUploadForOCR}
            />
          )}
        </div>
      </div>

      <OrderMobileSaveBar modifiedCount={editor.modifiedIds.size} isSavingAll={actions.isSavingAll} onSaveAll={actions.handleSaveAll} />

      <ReportItemSelectionDialog report={report} items={orderItems} />
      <CompanionCertificateFormDialog certificates={certificates} />

      <ReportPreviewDialog
        open={report.previewOpen}
        onOpenChange={report.setPreviewOpen}
        order={order}
        orderItems={report.previewItems}
        departmentOrder={departmentOrder}
        reportTemplate={organization?.report_template}
        patientData={patientInfo}
        labData={labData}
      />

      <ReceiptPreviewDialog
        open={receipt.open}
        onOpenChange={receipt.setOpen}
        orderItemsCount={orderItems.length}
        thermalReceiptData={thermalReceiptData}
        thermalPrinting={receipt.thermalPrinting}
        onPrintThermal={receipt.printThermal}
        thermalPaperOpen={receipt.thermalPaperOpen}
        setThermalPaperOpen={receipt.setThermalPaperOpen}
        thermalPaperMm={receipt.thermalPaperMm}
        setThermalPaperMm={receipt.setThermalPaperMm}
      />

      <LetterHeadPreviewDialog open={letterHead.open} onOpenChange={letterHead.setOpen} order={order} patientData={patientInfo} />

      <AttendanceCertificatePreviewDialog
        open={certificates.patientOpen}
        onOpenChange={certificates.setPatientOpen}
        order={order}
        labData={labData}
        subjectName={patientInfo.name}
        subjectDocumentId={patientInfo.id}
        title="Constancia de Asistencia"
        description="Revisa la constancia antes de imprimir"
        type="patient"
      />

      <AttendanceCertificatePreviewDialog
        open={certificates.companionOpen}
        onOpenChange={certificates.setCompanionOpen}
        order={order}
        labData={labData}
        subjectName={certificates.companionName}
        subjectDocumentId={certificates.companionDocumentId}
        title="Constancia de Acompañante"
        description="Revisa la constancia del acompañante antes de imprimir"
        type="companion"
      />

      {isErpEnabled && (
        <ConsumptionConfirmDialog
          open={actions.consumption.open}
          onOpenChange={actions.consumption.setOpen}
          order={{ id: order.id, org_id: order.org_id, order_seq: order.order_seq }}
          signature={actions.consumption.signature}
        />
      )}
    </div>
  );
}

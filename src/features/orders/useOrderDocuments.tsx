import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { toast } from "sonner";
import { getReportComponent } from "@/lib/orderReportDispatcher";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { LetterHeadPDF } from "@/lib/letterhead";
import { AttendanceCertificatePDF } from "@/lib/constanciaPDF";
import { CompanionAttendanceCertificatePDF } from "@/lib/constanciaAcomPDF";
import { buildPortalLink } from "@/features/patientPortal/portalLink";
import type { OrderItemResultsState } from "./useOrderResultsEditor";
import { buildOrderPatientInfo, buildThermalReceiptData, isMobileDevice } from "./orderDetailUtils";
import type { OrderDetailItem } from "./useOrders";
import type { OrderWithPatient } from "./schemas";
import type { buildLabData } from "./orderSectionsUtils";

type Order = OrderWithPatient;
type LabData = ReturnType<typeof buildLabData>;

/** On phones a PDF opens in a new tab instead of the in-page viewer. */
async function openPdfInNewTab(document: ReactElement<DocumentProps>, errorLabel: string, errorMessage: string) {
  try {
    const blob = await pdf(document).toBlob();
    window.open(URL.createObjectURL(blob), "_blank");
  } catch (error) {
    console.error(errorLabel, error);
    toast.error(errorMessage);
  }
}

/**
 * Every document of the order detail page: result report (PDF/Word) with exam
 * selection, receipt (PDF and thermal printer), letterhead, attendance certificates,
 * and the WhatsApp links to the patient portal.
 */
export function useOrderDocuments({
  order,
  orderItems,
  resultsState,
  organization,
  labData,
  departmentOrder,
}: {
  order: Order | null | undefined;
  orderItems: OrderDetailItem[];
  resultsState: Record<string, OrderItemResultsState>;
  organization: { primary_color?: string | null; report_template?: string | null } | null | undefined;
  labData: LabData;
  departmentOrder: string[];
}) {
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFormat, setReportFormat] = useState<"pdf" | "word">("pdf");
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reportItemSelectionOpen, setReportItemSelectionOpen] = useState(false);
  const [selectedReportItemIds, setSelectedReportItemIds] = useState<Set<string>>(new Set());
  const [previewReportItems, setPreviewReportItems] = useState<unknown[]>([]);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [thermalPaperOpen, setThermalPaperOpen] = useState(false);
  const [thermalPaperMm, setThermalPaperMm] = useState<"58" | "80">("58");
  const [letterHeadOpen, setLetterHeadOpen] = useState(false);
  const [attendanceCertificateOpen, setAttendanceCertificateOpen] = useState(false);
  const [companionCertificateFormOpen, setCompanionCertificateFormOpen] = useState(false);
  const [companionCertificateOpen, setCompanionCertificateOpen] = useState(false);
  const [companionName, setCompanionName] = useState("");
  const [companionDocumentId, setCompanionDocumentId] = useState("");

  const allReportItemIds = useMemo(() => orderItems.map((item) => String(item.id)), [orderItems]);
  const selectedReportItems = useMemo(
    () =>
      orderItems
        .filter((item) => selectedReportItemIds.has(String(item.id)))
        .map((item) => ({
          ...item,
          results_data: resultsState[String(item.id)] ?? item.results_data,
        })),
    [orderItems, selectedReportItemIds, resultsState]
  );
  const allItemsSelected = allReportItemIds.length > 0 && selectedReportItemIds.size === allReportItemIds.length;

  const patientInfo = order ? buildOrderPatientInfo(order) : null;
  const thermalReceiptData: ThermalReceiptData | null =
    order && patientInfo
      ? buildThermalReceiptData(
          order,
          orderItems,
          patientInfo,
          {
            ...labData,
            primary_color: organization?.primary_color || "#4f46e5",
          },
          window.location.origin
        )
      : null;

  function openReportItemSelection(format: "pdf" | "word") {
    if (orderItems.length === 0) {
      toast.error("No hay exámenes disponibles para imprimir.");
      return;
    }

    setReportFormat(format);
    setSelectedReportItemIds(new Set(allReportItemIds));
    setReportItemSelectionOpen(true);
  }

  async function handleConfirmReportSelection() {
    if (!order || !patientInfo) return;
    if (selectedReportItemIds.size === 0) {
      toast.error("Selecciona al menos un examen para generar el informe.");
      return;
    }

    setReportItemSelectionOpen(false);

    if (reportFormat === "word") {
      setReportLoading(true);
      try {
        const { generateUnifiedTestReportWord } = await import("@/lib/UnifiedTestReportWord");
        const reportBlob = await generateUnifiedTestReportWord({
          orden: order as never,
          orderItems: selectedReportItems as Array<Record<string, unknown>>,
          departmentOrder,
          patientData: { ...patientInfo, age: `${patientInfo.age}` },
          labData,
        });
        const downloadUrl = URL.createObjectURL(reportBlob);
        const downloadLink = document.createElement("a");
        const patientName = patientInfo.name.replace(/[<>:"/\\|?*]/g, "").trim() || "paciente";
        downloadLink.href = downloadUrl;
        downloadLink.download = `Informe-${patientName}-${String(order.order_seq).padStart(4, "0")}.docx`;
        downloadLink.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        toast.success("Informe Word generado y descargado.");
      } catch (error) {
        console.error("Error generando informe Word:", error);
        toast.error(getUserFacingErrorMessage(error, "No se pudo generar el informe Word."));
      } finally {
        setReportLoading(false);
      }
      return;
    }

    if (isMobileDevice()) {
      setReportLoading(true);
      const ReportComponent = getReportComponent(organization?.report_template);
      await openPdfInNewTab(
        <ReportComponent
          orden={order}
          orderItems={selectedReportItems as never}
          departmentOrder={departmentOrder}
          patientData={{ ...patientInfo, age: `${patientInfo.age}` }}
          labData={labData}
        /> as ReactElement<DocumentProps>,
        "Error generando reporte móvil:",
        "No se pudo abrir el informe en el móvil. Intenta descargarlo."
      );
      setReportLoading(false);
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
    setSelectedReportItemIds((prev) => (prev.size === allReportItemIds.length ? new Set() : new Set(allReportItemIds)));
  }

  async function handleViewLetterhead() {
    if (!order || !patientInfo) return;
    if (isMobileDevice()) {
      await openPdfInNewTab(
        <LetterHeadPDF orden={order as never} patientData={{ ...patientInfo, age: `${patientInfo.age}` }} />,
        "Error abriendo membrete móvil:",
        "No se pudo abrir el membrete en el móvil. Intenta descargarlo."
      );
    } else {
      setLetterHeadOpen(true);
    }
  }

  async function handleViewReceipt() {
    if (!thermalReceiptData) return;
    if (isMobileDevice()) {
      setReceiptLoading(true);
      await openPdfInNewTab(
        <OrderThermalReceiptPDF {...thermalReceiptData} />,
        "Error abriendo recibo móvil:",
        "No se pudo abrir la nota en el móvil. Intenta descargarla."
      );
      setReceiptLoading(false);
      return;
    }

    setReceiptOpen(true);
  }

  async function handleViewAttendanceCertificate() {
    if (!order) return;
    if (isMobileDevice()) {
      await openPdfInNewTab(
        <AttendanceCertificatePDF order={order as never} labData={labData} />,
        "Error abriendo constancia móvil:",
        "No se pudo abrir la constancia en el móvil. Intenta descargarla."
      );
      return;
    }

    setAttendanceCertificateOpen(true);
  }

  async function handleConfirmCompanionCertificate() {
    if (!order) return;
    const trimmedName = companionName.trim();
    const trimmedDocumentId = companionDocumentId.trim();

    if (!trimmedName || !trimmedDocumentId) {
      toast.error("Debes ingresar el nombre y la cédula del acompañante.");
      return;
    }

    setCompanionCertificateFormOpen(false);

    if (isMobileDevice()) {
      await openPdfInNewTab(
        <CompanionAttendanceCertificatePDF
          order={order as never}
          labData={labData}
          subjectName={trimmedName}
          subjectDocumentId={trimmedDocumentId}
        />,
        "Error abriendo constancia de acompanante movil:",
        "No se pudo abrir la constancia del acompañante en el móvil. Intenta descargarla."
      );
      return;
    }

    setCompanionCertificateOpen(true);
  }

  async function handlePrintThermal(paperMm: 58 | 80) {
    if (!thermalReceiptData) return;
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

  const patients = order?.patients;

  function handleSharePortalLink() {
    if (!order) return;
    const patientDni = patients?.id_number || "";

    if (!patientDni) {
      toast.error("El paciente no tiene un documento de identidad registrado.");
      return;
    }

    const portalUrl = buildPortalLink(window.location.origin, "/portal-paciente", {
      orgId: order.org_id,
      dni: patientDni,
      pin: String(order.access_pin ?? ""),
    });

    const phoneDigits = (patients?.phone || "").replace(/\D/g, "");
    if (!phoneDigits) {
      toast.error("El paciente no tiene un número de teléfono registrado.");
      return;
    }

    const text = encodeURIComponent(`Tus resultados están listos, los puedes ver de inmediato en el siguiente enlace: ${portalUrl}`);
    window.open(`https://wa.me/58${phoneDigits}?text=${text}`, "_blank");
  }

  function handleSharePdfDirectLink() {
    if (!order) return;
    const patientDni = patients?.id_number || "";
    const pdfUrl = buildPortalLink(window.location.origin, "/informe-pdf", {
      orgId: order.org_id,
      dni: patientDni,
      pin: String(order.access_pin ?? ""),
    });

    const phoneDigits = (patients?.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(`Hola, puedes ver e imprimir tu informe de resultados directamente en este enlace: ${pdfUrl}`);

    window.open(`https://wa.me/58${phoneDigits}?text=${text}`, "_blank");
  }

  return {
    patientInfo,
    thermalReceiptData,
    report: {
      loading: reportLoading,
      format: reportFormat,
      selectionOpen: reportItemSelectionOpen,
      setSelectionOpen: setReportItemSelectionOpen,
      selectedIds: selectedReportItemIds,
      allSelected: allItemsSelected,
      toggleItem: toggleReportItemSelection,
      toggleAll: toggleSelectAllReportItems,
      confirmSelection: handleConfirmReportSelection,
      viewPdf: () => openReportItemSelection("pdf"),
      generateWord: () => openReportItemSelection("word"),
      previewOpen: unifiedOpen,
      setPreviewOpen: setUnifiedOpen,
      previewItems: previewReportItems,
    },
    receipt: {
      loading: receiptLoading,
      open: receiptOpen,
      setOpen: setReceiptOpen,
      view: handleViewReceipt,
      thermalPrinting,
      printThermal: handlePrintThermal,
      thermalPaperOpen,
      setThermalPaperOpen,
      thermalPaperMm,
      setThermalPaperMm,
    },
    letterHead: { open: letterHeadOpen, setOpen: setLetterHeadOpen, view: handleViewLetterhead },
    certificates: {
      patientOpen: attendanceCertificateOpen,
      setPatientOpen: setAttendanceCertificateOpen,
      viewPatient: handleViewAttendanceCertificate,
      companionFormOpen: companionCertificateFormOpen,
      setCompanionFormOpen: setCompanionCertificateFormOpen,
      companionOpen: companionCertificateOpen,
      setCompanionOpen: setCompanionCertificateOpen,
      companionName,
      setCompanionName,
      companionDocumentId,
      setCompanionDocumentId,
      confirmCompanion: handleConfirmCompanionCertificate,
    },
    share: { portalLink: handleSharePortalLink, pdfLink: handleSharePdfDirectLink },
  };
}

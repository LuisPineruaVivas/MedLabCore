import { useMemo } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DynamicTestReportPDF } from "@/lib/orderReportDispatcher";
import type { OrderRow } from "@/features/orders/schemas";

// ── Dummy data used only for the live preview ─────────────────────────────────

const DUMMY_PATIENT = {
  name: "PACIENTE DE PRUEBA",
  id: "12345678",
  age: "35 Años",
  gender: "Masculino",
};

/** Minimal OrderRow shape needed to render the PDF without errors */
const DUMMY_ORDER: OrderRow = {
  id: "preview-00000000-0000-0000-0000-000000000000",
  org_id: "preview",
  patient_id: "preview",
  order_seq: 1,
  status: "pendiente",
  payment_status: "unpaid",
  total_amount: 0,
  total_bs: null,
  is_exempted: false,
  exchange_rate: null,
  access_pin: null,
  firma_url: null,
  firma_name: null,
  sello_url: null,
  signature_footer_text: null,
  notes: null,
  created_at: new Date().toISOString(),
  created_by: "preview",
  updated_at: new Date().toISOString(),
  completed_at: null,
};

const DUMMY_ORDER_ITEMS = [
  {
    test_name: "Glucosa",
    category: "QUÍMICA SANGUÍNEA",
    resolved_sort_order: 1,
    method_name: null,
    test_templates: { category: "QUÍMICA SANGUÍNEA", result_type: "STANDARD", schema: null },
    results_data: {
      sections: [
        {
          name: "",
          fields: [
            {
              id: "glucose",
              label: "Glucosa",
              type: "number",
              value: "95",
              unit: "mg/dL",
              reference_ranges: [{ min: 70, max: 110, label: "70 - 110", gender: null, age_min: null, age_max: null }],
            },
          ],
        },
      ],
    },
  },
  {
    test_name: "Hemoglobina",
    category: "HEMATOLOGÍA",
    resolved_sort_order: 1,
    method_name: null,
    test_templates: { category: "HEMATOLOGÍA", result_type: "STANDARD", schema: null },
    results_data: {
      sections: [
        {
          name: "",
          fields: [
            {
              id: "hgb",
              label: "Hemoglobina",
              type: "number",
              value: "14.5",
              unit: "g/dL",
              reference_ranges: [{ min: 12, max: 18, label: "12 - 18", gender: null, age_min: null, age_max: null }],
            },
            {
              id: "hct",
              label: "Hematocrito",
              type: "number",
              value: "43",
              unit: "%",
              reference_ranges: [{ min: 36, max: 54, label: "36 - 54", gender: null, age_min: null, age_max: null }],
            },
          ],
        },
      ],
    },
  },
  {
    test_name: "Observaciones clínicas",
    category: "HEMATOLOGÍA",
    resolved_sort_order: 2,
    method_name: null,
    test_templates: { category: "HEMATOLOGÍA", result_type: "STANDARD", schema: { hide_table_header: true } },
    results_data: {
      hide_table_header: true,
      sections: [
        {
          name: "Observaciones",
          fields: [
            {
              id: "obs",
              label: "Observaciones",
              type: "text",
              value: "Sin hallazgos significativos.",
              unit: null,
              reference_ranges: [],
            },
          ],
        },
      ],
    },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface PreviewLabData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
  primary_color?: string;
  secondary_color?: string;
  report_footer_text?: string | null;
}

interface ReportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labData: PreviewLabData;
  reportTemplate?: string;
}

export function ReportPreviewModal({
  open,
  onOpenChange,
  labData,
  reportTemplate = "default",
}: ReportPreviewModalProps) {
  // Only memoize so the PDF doesn't re-render on every keystroke outside the modal
  const stableLabData = useMemo(() => labData, [
    labData.name,
    labData.address,
    labData.phone,
    labData.email,
    labData.logo,
    labData.primary_color,
    labData.secondary_color,
    labData.report_footer_text,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-base">
            Vista previa del informe
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — datos de muestra, no corresponden a una orden real
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {open && (
            <PDFViewer width="100%" height="100%" style={{ border: "none" }}>
              <DynamicTestReportPDF
                reportTemplate={reportTemplate}
                orden={DUMMY_ORDER}
                orderItems={DUMMY_ORDER_ITEMS}
                departmentOrder={["QUÍMICA SANGUÍNEA", "HEMATOLOGÍA"]}
                patientData={DUMMY_PATIENT}
                labData={stableLabData}
              />
            </PDFViewer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { TestTemplateFormData } from "@/features/tests/schemas";
import { PDFViewer } from "@react-pdf/renderer";
import { getTestTemplateReportComponent, type TestTemplateReportProps } from "@/lib/orderReportDispatcher";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MicrobiologyFieldDef } from "@/features/microbiology/types";

/** PDF preview of the template as it would print, with the lab's report layout. */
export function TemplatePreviewDialog({
  open,
  onOpenChange,
  PreviewReport,
  currentFormData,
  microbiologyFields,
  templateId,
  labData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  PreviewReport: ReturnType<typeof getTestTemplateReportComponent>;
  currentFormData: TestTemplateFormData;
  microbiologyFields: MicrobiologyFieldDef[];
  templateId: string | undefined;
  labData: TestTemplateReportProps["labData"];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="sr-only">Vista Previa del Examen</DialogTitle>
        <DialogDescription className="sr-only">Revisa como se vera el informe antes de guardarlo</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden border-none">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="font-medium text-sm">
                Vista Previa: {currentFormData.name || "Nuevo Examen"}
              </h3>
              {currentFormData.result_type === "MICROBIOLOGY" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Datos ficticios de ejemplo para mostrar el informe bacteriológico.
                </p>
              )}
            </div>
          </div>
          <div className="flex-1 bg-white">
            <PDFViewer width="100%" height="100%" showToolbar={true}>
              <PreviewReport
                template={{
                  id: templateId || "preview",
                  name: currentFormData.name,
                  category: currentFormData.category,
                  base_price: currentFormData.base_price,
                  schema: currentFormData.result_type === "MICROBIOLOGY"
                    ? { sections: [], microbiology_fields: microbiologyFields }
                    : currentFormData.schema,
                  is_active: true,
                  org_id: null,
                  created_at: "",
                  updated_at: "",
                  result_type: currentFormData.result_type,
                }}
                labData={labData}
              />
            </PDFViewer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

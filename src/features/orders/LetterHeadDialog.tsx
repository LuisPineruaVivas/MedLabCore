import { PDFViewer } from "@react-pdf/renderer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LetterHeadPDF } from "@/lib/letterhead";

interface LetterHeadPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: unknown;
  patientData: {
    name: string;
    id: string;
    date: string;
    age: string | number;
    gender: string;
  };
}

export function LetterHeadPreviewDialog({
  open,
  onOpenChange,
  order,
  patientData,
}: LetterHeadPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle>Membrete</DialogTitle>
          <DialogDescription>Revisa el membrete antes de imprimir</DialogDescription>
        </DialogHeader>
        <div className="h-full flex-1 overflow-hidden rounded-md border bg-muted">
            <PDFViewer width="100%" height="100%" className="border-none">
              <LetterHeadPDF
                orden={order as never}
                patientData={{ ...patientData, age: `${patientData.age}` }}
              />
            </PDFViewer>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

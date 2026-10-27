import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { useOrderDocuments } from "./useOrderDocuments";

type Documents = ReturnType<typeof useOrderDocuments>;

/** Lets the user pick which exams go into the PDF/Word report. */
export function ReportItemSelectionDialog({
  report,
  items,
}: {
  report: Documents["report"];
  items: Array<{ id: string | number; test_name?: string; name?: string }>;
}) {
  return (
    <Dialog open={report.selectionOpen} onOpenChange={report.setSelectionOpen}>
      <DialogContent className="sm:max-w-3xl w-[90vw]">
        <DialogHeader>
          <DialogTitle>Seleccionar exámenes para el informe {report.format === "word" ? "Word" : "PDF"}</DialogTitle>
          <DialogDescription>
            Elige los exámenes que quieres incluir en el informe. Puedes seleccionar todos o marcar los que ya estén completos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm transition hover:bg-muted">
            <input
              type="checkbox"
              checked={report.allSelected}
              onChange={report.toggleAll}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="font-medium">              Seleccionar todos</span>
          </label>
          <div className="grid gap-2 max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-background p-3">
            {items.map((item) => {
              const itemId = String(item.id);
              const itemLabel = item.test_name || item.name || itemId;
              return (
                <label key={itemId} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 p-3 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={report.selectedIds.has(itemId)}
                    onChange={() => report.toggleItem(itemId)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{itemLabel}</span>
                </label>
              );
            })}
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => report.setSelectionOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={report.confirmSelection} disabled={report.selectedIds.size === 0 || report.loading}>
            {report.format === "word" ? "Generar Word" : "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Asks for the companion's name and ID before generating their certificate. */
export function CompanionCertificateFormDialog({ certificates }: { certificates: Documents["certificates"] }) {
  return (
    <Dialog
      open={certificates.companionFormOpen}
      onOpenChange={(open) => {
        certificates.setCompanionFormOpen(open);
        if (!open) {
          certificates.setCompanionOpen(false);
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
              value={certificates.companionName}
              onChange={(event) => certificates.setCompanionName(event.target.value)}
              placeholder="Ej. Maria Perez"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companion-document">Cédula</Label>
            <Input
              id="companion-document"
              value={certificates.companionDocumentId}
              onChange={(event) => certificates.setCompanionDocumentId(event.target.value)}
              placeholder="Ej. 12345678"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => certificates.setCompanionFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={certificates.confirmCompanion}>Generar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

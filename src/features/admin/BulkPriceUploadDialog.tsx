import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileImage,
  FileText,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  useBulkPriceUpload,
  type MatchedPriceItem,
  type MatchConfidence,
  type GlobalTemplate,
} from "@/features/admin/useBulkPriceUpload";

// ── Global templates query ────────────────────────────────────────
function useGlobalTemplates() {
  return useQuery({
    queryKey: queryKeys.admin.globalTemplatesForBulk,
    queryFn: async (): Promise<GlobalTemplate[]> => {
      const { data, error } = await supabase
        .from("test_templates")
        .select("id, name")
        .is("org_id", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as GlobalTemplate[];
    },
  });
}

// ── Badge helpers ─────────────────────────────────────────────────
function ConfidenceBadge({ label, score }: { label: MatchConfidence; score: number }) {
  if (label === "high")
    return <Badge className="bg-green-100 text-green-800 border-green-300">✓ {score}%</Badge>;
  if (label === "medium")
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">~ {score}%</Badge>;
  if (label === "low")
    return <Badge className="bg-orange-100 text-orange-800 border-orange-300">? {score}%</Badge>;
  return <Badge variant="destructive">Sin coincidencia</Badge>;
}

// ── File reading helpers ──────────────────────────────────────────
async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readDocxAsText(file: File): Promise<string> {
  // Dynamically import mammoth to extract text from .docx
  // We send the raw text to Gemini which then structures it.
  // Bundled from package-lock (not a CDN URL) so the code is pinned and integrity-checked.
  const { default: mammoth } = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// ── Step indicator ────────────────────────────────────────────────
function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
          done
            ? "bg-primary border-primary text-primary-foreground"
            : active
            ? "border-primary text-primary bg-primary/10"
            : "border-muted-foreground/30 text-muted-foreground"
        }`}
      >
        {done ? "✓" : label[0]}
      </div>
      <span className={`text-[10px] ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────
interface BulkPriceUploadDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
}

export function BulkPriceUploadDialog({
  open,
  onClose,
  orgId,
  orgName,
}: BulkPriceUploadDialogProps) {
  const { data: globalTemplates = [], isLoading: loadingTemplates } = useGlobalTemplates();
  const { state, isParsing, isApplying, parseFile, updateItem, removeItem, applyPrices, reset } =
    useBulkPriceUpload();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith("image/");
      const isDocx =
        file.name.endsWith(".docx") ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (!isImage && !isDocx) {
        toast.error("Solo se aceptan imágenes (PNG, JPG) o documentos Word (.docx)");
        return;
      }

      try {
        if (isImage) {
          const base64 = await readFileAsBase64(file);
          await parseFile({ file_base64: base64, mime_type: file.type }, globalTemplates);
        } else {
          const text = await readDocxAsText(file);
          await parseFile({ text_content: text, mime_type: "text/plain" }, globalTemplates);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al leer el archivo";
        toast.error(msg);
      }
    },
    [globalTemplates, parseFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const matchedCount = state.matchedItems.filter((i) => i.global_template_id !== null).length;
  const unmatchedCount = state.matchedItems.filter((i) => i.global_template_id === null).length;

  const stepIndex = { idle: 0, parsing: 1, review: 2, applying: 3, done: 3 }[state.step];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Cargar Precios en Bulk
          </DialogTitle>
          <DialogDescription>
            Laboratorio: <span className="font-medium text-foreground">{orgName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* ── Stepper ── */}
        <div className="flex items-center justify-center gap-4 py-2 shrink-0">
          <StepDot active={stepIndex === 0} done={stepIndex > 0} label="Archivo" />
          <div className="flex-1 h-px bg-border max-w-[60px]" />
          <StepDot active={stepIndex === 1} done={stepIndex > 1} label="Procesando" />
          <div className="flex-1 h-px bg-border max-w-[60px]" />
          <StepDot active={stepIndex === 2} done={stepIndex > 2} label="Revisión" />
          <div className="flex-1 h-px bg-border max-w-[60px]" />
          <StepDot active={stepIndex === 3} done={state.step === "done"} label="Listo" />
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Error banner */}
          {state.error && (
            <div className="mx-1 mb-3 p-3 rounded-md bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {state.error}
            </div>
          )}

          {/* ── Step: idle / upload ── */}
          {(state.step === "idle") && (
            <div className="space-y-4 p-1">
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
                  ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex justify-center gap-4 mb-4">
                  <FileImage className="w-10 h-10 text-muted-foreground" />
                  <FileText className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Arrastra el baremo aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceptados: PNG, JPG (foto/scan del baremo) o DOCX (Word)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {loadingTemplates && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando catálogo de exámenes…
                </p>
              )}

              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">¿Cómo funciona?</p>
                <p>1. Sube la imagen o el Word del baremo del laboratorio.</p>
                <p>2. Gemini extrae automáticamente los nombres y precios.</p>
                <p>3. Revisas las coincidencias con el catálogo y confirmas.</p>
                <p>4. Se crean/actualizan los precios del laboratorio en un solo click.</p>
              </div>
            </div>
          )}

          {/* ── Step: parsing ── */}
          {state.step === "parsing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Analizando el baremo…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Gemini está extrayendo los exámenes y precios
                </p>
              </div>
            </div>
          )}

          {/* ── Step: review ── */}
          {state.step === "review" && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="text-muted-foreground">
                  {state.matchedItems.length} exámenes extraídos:
                </span>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {matchedCount} con coincidencia
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {unmatchedCount} sin coincidencia
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={reset}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Cambiar archivo
                </Button>
              </div>

              {/* Review table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Extraído del baremo</TableHead>
                      <TableHead className="text-xs">Examen del catálogo</TableHead>
                      <TableHead className="text-xs text-center">Coincidencia</TableHead>
                      <TableHead className="text-xs text-right">Precio (\$)</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.matchedItems.map((item, idx) => (
                      <ReviewRow
                        key={idx}
                        item={item}
                        index={idx}
                        globalTemplates={globalTemplates}
                        onUpdate={(patch) => updateItem(idx, patch)}
                        onRemove={() => removeItem(idx)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {unmatchedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  💡 Los exámenes sin coincidencia serán <strong>ignorados</strong>. Puedes asignarles manualmente un examen del catálogo usando el selector.
                </p>
              )}
            </div>
          )}

          {/* ── Step: applying ── */}
          {state.step === "applying" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="font-medium">Aplicando precios…</p>
            </div>
          )}

          {/* ── Step: done ── */}
          {state.step === "done" && state.result && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <div>
                <p className="text-lg font-semibold">¡Precios actualizados!</p>
                <p className="text-muted-foreground mt-1">
                  <strong className="text-foreground">{state.result.applied}</strong> exámenes actualizados
                  {state.result.skipped > 0 && (
                    <>, <strong className="text-foreground">{state.result.skipped}</strong> ignorados</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="shrink-0 border-t pt-3">
          {state.step === "idle" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          {state.step === "review" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => applyPrices(orgId)}
                disabled={matchedCount === 0}
              >
                Aplicar {matchedCount} precio{matchedCount !== 1 ? "s" : ""}
              </Button>
            </>
          )}
          {state.step === "done" && (
            <Button onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Review Row ────────────────────────────────────────────────────
function ReviewRow({
  item,
  index,
  globalTemplates,
  onUpdate,
  onRemove,
}: {
  item: MatchedPriceItem;
  index: number;
  globalTemplates: GlobalTemplate[];
  onUpdate: (patch: Partial<MatchedPriceItem>) => void;
  onRemove: () => void;
}) {
  const rowBg =
    item.global_template_id === null
      ? "bg-red-50/50"
      : item.confidence_label === "high"
      ? ""
      : item.confidence_label === "medium"
      ? "bg-yellow-50/30"
      : "bg-orange-50/30";

  return (
    <TableRow className={rowBg}>
      {/* Extracted name */}
      <TableCell className="text-xs font-mono py-2">
        {item.extracted_name}
      </TableCell>

      {/* Matched template select */}
      <TableCell className="py-2">
        <Select
          value={item.global_template_id ?? "__none__"}
          onValueChange={(val) => {
            if (val === "__none__") {
              onUpdate({ global_template_id: null, matched_name: null, confidence: 0, confidence_label: "none" });
            } else {
              const tpl = globalTemplates.find((t) => t.id === val);
              onUpdate({
                global_template_id: val,
                matched_name: tpl?.name ?? null,
                confidence: 100,
                confidence_label: "high",
              });
            }
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Sin coincidencia — selecciona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">— Ignorar este examen —</span>
            </SelectItem>
            {globalTemplates.map((tpl) => (
              <SelectItem key={tpl.id} value={tpl.id}>
                {tpl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Confidence badge */}
      <TableCell className="text-center py-2">
        <ConfidenceBadge label={item.confidence_label} score={item.confidence} />
      </TableCell>

      {/* Price input */}
      <TableCell className="py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={item.price}
          onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
          className="h-7 text-xs text-right w-24 ml-auto"
        />
      </TableCell>

      {/* Remove */}
      <TableCell className="py-2 text-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Eliminar fila"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

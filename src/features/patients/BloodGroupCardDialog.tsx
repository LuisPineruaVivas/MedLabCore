import { useState, useEffect } from "react";
import { pdf, PDFViewer } from "@react-pdf/renderer";
import { Printer, Download, Eye, HeartPulse, Sparkles, User, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format, parse, isValid } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BloodGroupCardPDF } from "@/lib/bloodGroupCardPDF";

interface BloodGroupCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    first_name: string;
    last_name: string;
    id_number: string;
    date_of_birth?: string | Date | null;
  };
  organization?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    rif?: string | null;
    city?: string | null;
    state?: string | null;
    primary_color?: string | null;
  } | null;
  profile?: {
    full_name?: string | null;
    firma_url?: string | null;
    sello_url?: string | null;
    signature_footer_text?: string | null;
  } | null;
}

/** Format any date-like value to dd/MM/yyyy for display on card */
function formatDob(dob: string | Date | null | undefined): string {
  if (!dob) return "";
  try {
    const d = typeof dob === "string" ? parse(dob, "yyyy-MM-dd", new Date()) : dob;
    if (!isValid(d)) return typeof dob === "string" ? dob : "";
    return format(d, "dd/MM/yyyy");
  } catch {
    return "";
  }
}

export function BloodGroupCardDialog({
  open,
  onOpenChange,
  patient,
  organization,
  profile,
}: BloodGroupCardDialogProps) {
  const [patientName, setPatientName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bloodGroup, setBloodGroup] = useState("O");
  const [rhFactor, setRhFactor] = useState("Positivo (+)");
  const [viewMode, setViewMode] = useState<"live" | "pdf">("live");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open && patient) {
      setPatientName(`${patient.first_name} ${patient.last_name}`.trim());
      setIdNumber(patient.id_number || "");
      setDateOfBirth(formatDob(patient.date_of_birth));
      setBloodGroup("O");
      setRhFactor("Positivo (+)");
      setViewMode("live");
    }
  }, [open, patient]);

  const labData = {
    name: organization?.name || "LABORATORIO CLÍNICO",
    address: organization?.address || undefined,
    phone: organization?.phone || undefined,
    email: organization?.email || undefined,
    rif: organization?.rif || undefined,
    city: organization?.city || undefined,
    state: organization?.state || undefined,
    primary_color: organization?.primary_color || "#1e3a8a",
  };

  const bioanalystData = {
    name: profile?.full_name || undefined,
    signatureUrl: profile?.firma_url || undefined,
    stampUrl: profile?.sello_url || undefined,
    footerText: profile?.signature_footer_text || undefined,
  };

  const cleanIdNumber = idNumber.trim();
  const hasIdNumber = cleanIdNumber.length > 0;
  const cleanDob = dateOfBirth.trim();
  const hasDob = cleanDob.length > 0;

  async function handlePrintOrDownloadPDF(action: "print" | "download") {
    try {
      setIsGenerating(true);
      const blob = await pdf(
        <BloodGroupCardPDF
          patientName={patientName.trim()}
          idNumber={cleanIdNumber}
          dateOfBirth={cleanDob}
          bloodGroup={bloodGroup}
          rhFactor={rhFactor}
          labData={labData}
          bioanalystData={bioanalystData}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);

      if (action === "download") {
        const link = document.createElement("a");
        link.href = url;
        const filenameSafe = patientName.trim().replace(/[^a-zA-Z0-9]/g, "_") || "paciente";
        link.download = `Tarjeta_Tipiaje_${filenameSafe}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Tarjeta descargada correctamente");
      } else {
        const printWindow = window.open(url, "_blank");
        if (!printWindow) {
          toast.error("No se pudo abrir la ventana de impresión. Revisa si tu navegador bloquea las ventanas emergentes.");
        }
      }
    } catch (error) {
      console.error("Error generando PDF de tarjeta de tipiaje:", error);
      toast.error("Error al generar el PDF de la tarjeta.");
    } finally {
      setIsGenerating(false);
    }
  }

  const rifText = labData.rif ? `RIF: ${labData.rif}` : "";
  const phone = labData.phone ? `Tel: ${labData.phone}` : "";
  const locationText = [rifText, phone].filter(Boolean).join("   ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <HeartPulse className="w-5 h-5 text-red-500" />
            Tarjeta de Tipiaje / Grupo Sanguíneo
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Verifica o edita los datos del paciente y selecciona su grupo sanguíneo antes de generar la tarjeta física (tamaño carnet/bolsillo).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 overflow-y-auto pr-1">
          {/* Form Settings - Left Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 border space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Datos del Paciente
              </h4>

              {/* Nombre Completo */}
              <div className="space-y-1.5">
                <Label htmlFor="bg-card-name" className="text-xs font-medium">
                  Nombre Completo
                </Label>
                <Input
                  id="bg-card-name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Ej: Pedro Pérez"
                  className="h-9 text-sm"
                />
              </div>

              {/* Cédula / Identificación */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bg-card-id" className="text-xs font-medium">
                    Cédula / Identificación
                  </Label>
                  {!hasIdNumber && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Omitida (Sin renglón C.I.)
                    </span>
                  )}
                </div>
                <Input
                  id="bg-card-id"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="Dejar en blanco si es menor sin cédula"
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Si borras este campo el renglón <span className="font-semibold">C.I. No:</span> NO aparecerá en la tarjeta.
                </p>
              </div>

              {/* Fecha de Nacimiento */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bg-card-dob" className="text-xs font-medium">
                    Fecha de Nacimiento
                  </Label>
                  {!hasDob && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Omitida de la tarjeta
                    </span>
                  )}
                </div>
                <Input
                  id="bg-card-dob"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  placeholder="Ej: 15/06/1990"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Configuración Sanguínea */}
            <div className="bg-muted/30 rounded-lg p-3 border space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-red-500" />
                Tipiaje Sanguíneo
              </h4>

              <div className="grid grid-cols-2 gap-3">
                {/* Grupo Sanguíneo */}
                <div className="space-y-1.5">
                  <Label htmlFor="bg-card-group" className="text-xs font-medium">
                    Grupo Sanguíneo
                  </Label>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger id="bg-card-group" className="h-9 text-sm">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Grupo A</SelectItem>
                      <SelectItem value="B">Grupo B</SelectItem>
                      <SelectItem value="AB">Grupo AB</SelectItem>
                      <SelectItem value="O">Grupo O</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Factor RH */}
                <div className="space-y-1.5">
                  <Label htmlFor="bg-card-rh" className="text-xs font-medium">
                    Factor RH
                  </Label>
                  <Select value={rhFactor} onValueChange={setRhFactor}>
                    <SelectTrigger id="bg-card-rh" className="h-9 text-sm">
                      <SelectValue placeholder="Factor RH" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Positivo (+)">Positivo (+)</SelectItem>
                      <SelectItem value="Negativo (-)">Negativo (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Toggle View Mode */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant={viewMode === "live" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setViewMode("live")}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Vista Previa Interactiva
              </Button>
              <Button
                type="button"
                variant={viewMode === "pdf" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setViewMode("pdf")}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Vista PDF
              </Button>
            </div>
          </div>

          {/* Card Live / PDF Preview - Right Column */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl p-4 border min-h-[300px]">
            {viewMode === "live" ? (
              <div className="w-full flex flex-col items-center">
                <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Renderizado en Tiempo Real (Proporción 8.5 cm × 5.5 cm)
                </div>

                {/* Realistic Wallet Card HTML Rendering */}
                <div
                  className="w-full max-w-[420px] aspect-[85/55] bg-white rounded-lg p-3 shadow-md border-2 flex flex-col justify-between text-slate-800 transition-all select-none"
                  style={{ borderColor: labData.primary_color }}
                >
                  {/* Header */}
                  <div className="text-center space-y-0.5">
                    <p
                      className="font-bold text-[13px] tracking-wide leading-tight uppercase"
                      style={{ color: labData.primary_color }}
                    >
                      {labData.name}
                    </p>
                    {labData.address && (
                      <p className="text-[8px] text-slate-600 leading-tight">
                        {labData.address}
                      </p>
                    )}
                    {locationText ? (
                      <p className="text-[8px] text-slate-600 leading-tight">
                        {locationText}
                      </p>
                    ) : null}
                  </div>

                  {/* Card Body */}
                  <div className="space-y-1.5">
                    {/* Nombre */}
                    <div
                      className="border-b pb-0.5 flex items-baseline gap-1.5"
                      style={{ borderColor: labData.primary_color }}
                    >
                      <span
                        className="text-[10px] font-bold uppercase shrink-0"
                        style={{ color: labData.primary_color }}
                      >
                        NOMBRE:
                      </span>
                      <span className="text-[11px] font-bold uppercase truncate text-slate-900">
                        {patientName || "—"}
                      </span>
                    </div>

                    {/* C.I. — solo si hay valor */}
                    {hasIdNumber && (
                      <div
                        className="border-b pb-0.5 flex items-baseline gap-1.5"
                        style={{ borderColor: labData.primary_color }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase shrink-0"
                          style={{ color: labData.primary_color }}
                        >
                          C.I. No:
                        </span>
                        <span className="text-[11px] font-semibold uppercase text-slate-800">
                          {cleanIdNumber}
                        </span>
                      </div>
                    )}

                    {/* Fecha de Nacimiento — solo si hay valor */}
                    {hasDob && (
                      <div
                        className="border-b pb-0.5 flex items-baseline gap-1.5"
                        style={{ borderColor: labData.primary_color }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase shrink-0"
                          style={{ color: labData.primary_color }}
                        >
                          FECHA NACIMIENTO:
                        </span>
                        <span className="text-[11px] font-semibold text-slate-800">
                          {cleanDob}
                        </span>
                      </div>
                    )}

                    {/* Blood Info */}
                    <div
                      className="border-b pb-0.5 flex items-center justify-between"
                      style={{ borderColor: labData.primary_color }}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: labData.primary_color }}
                        >
                          GRUPO SANGUÍNEO:
                        </span>
                        <span className="text-[12px] font-bold text-red-600">
                          {bloodGroup}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: labData.primary_color }}
                        >
                          FACTOR RH:
                        </span>
                        <span className="text-[12px] font-bold text-red-600">
                          {rhFactor}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer / Signature */}
                  <div className="mt-1 flex justify-end">
                    <div className="w-[52%] flex flex-col items-center">
                      {(bioanalystData.signatureUrl || bioanalystData.stampUrl) && (
                        <div className="flex items-end justify-center gap-2 mb-0.5 h-5">
                          {bioanalystData.signatureUrl && (
                            <img
                              src={bioanalystData.signatureUrl}
                              alt="Firma"
                              className="max-h-5 object-contain"
                            />
                          )}
                          {bioanalystData.stampUrl && (
                            <img
                              src={bioanalystData.stampUrl}
                              alt="Sello"
                              className="max-h-5 object-contain"
                            />
                          )}
                        </div>
                      )}
                      <div
                        className="w-full border-t mb-0.5"
                        style={{ borderColor: labData.primary_color }}
                      />
                      <span
                        className="text-[8px] font-bold uppercase text-center tracking-wider leading-none"
                        style={{ color: labData.primary_color }}
                      >
                        LIC. EN BIOANALISTA
                      </span>
                      {bioanalystData.name && (
                        <span className="text-[7.5px] text-slate-600 text-center leading-tight truncate max-w-full mt-0.5">
                          {bioanalystData.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hint about print size */}
                <p className="mt-3 text-[11px] text-center text-muted-foreground max-w-[360px]">
                  💡 El PDF generado es tamaño carta. Al imprimir, selecciona{" "}
                  <span className="font-semibold">Tamaño real (100%)</span> para que la tarjeta
                  salga en la esquina superior izquierda con su tamaño físico correcto.
                </p>
              </div>
            ) : (
              <div className="w-full h-[340px] rounded-lg overflow-hidden border bg-white">
                <PDFViewer width="100%" height="100%" className="border-none">
                  <BloodGroupCardPDF
                    patientName={patientName.trim()}
                    idNumber={cleanIdNumber}
                    dateOfBirth={cleanDob}
                    bloodGroup={bloodGroup}
                    rhFactor={rhFactor}
                    labData={labData}
                    bioanalystData={bioanalystData}
                  />
                </PDFViewer>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2 border-t pt-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={isGenerating || !patientName.trim()}
            onClick={() => handlePrintOrDownloadPDF("download")}
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>

          <Button
            type="button"
            disabled={isGenerating || !patientName.trim()}
            onClick={() => handlePrintOrDownloadPDF("print")}
            className="w-full sm:w-auto"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / Abrir PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

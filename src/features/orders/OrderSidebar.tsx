import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, FileText, IdCard, Link as LinkIcon, Mail, Phone, User, Lock } from "lucide-react";
import type { PatientInfo, OrderWithPatient } from "./orderDetailTypes";

interface OrderSidebarProps {
  order: OrderWithPatient;
  patientInfo: PatientInfo;
  onSharePortalLink: () => void;
  onSharePdfDirectLink: () => void;
  onGenerateCertificate: () => void;
  onGenerateCompanionCertificate: () => void;
  onGenerateLetterHead: () => void;
  showDocumentActions?: boolean;
  showSharePortalAction?: boolean;
}

export const OrderSidebar = memo(function OrderSidebar({
  order,
  patientInfo,
  onSharePortalLink,
  onSharePdfDirectLink,
  onGenerateCertificate,
  onGenerateCompanionCertificate,
  onGenerateLetterHead,
  showDocumentActions = true,
  showSharePortalAction = true,
}: OrderSidebarProps) {
  return (
    <div className="w-[100%] shrink-0 space-y-6  lg:w-[30%]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <InfoRow icon={User} label="Paciente" value={toTitleCase(patientInfo.name)} />
            <InfoRow icon={IdCard} label="Cédula" value={patientInfo.id} />
            <InfoRow
              icon={Calendar}
              label="Edad / Género"
              value={`${String(patientInfo.age).replace(/Años?/, (word) => word.toLowerCase())}${typeof patientInfo.age === "number" ? " años" : ""} · ${toTitleCase(patientInfo.gender)}`}
            />
            <InfoRow icon={Phone} label="Teléfono" value={order.patients.phone || "No registrado"} />
            <InfoRow icon={Mail} label="Correo" value={order.patients.email || "No registrado"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Orden #{order.order_seq.toString().padStart(4, "0")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              <InfoRow
              icon={DollarSign}
              label="Total USD"
              value={`USD ${Number(order.total_amount).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              iconClassName="text-success"
              valueClassName="font-semibold tabular-nums"
            />
            {order.total_bs != null && (
              <InfoRow
                icon={DollarSign}
                label="Total Bs"
                value={`Bs ${Number(order.total_bs).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                iconClassName="text-muted-foreground"
                valueClassName="font-medium tabular-nums"
              />
            )}
            <InfoRow
              icon={Calendar}
              label="Fecha de creación"
              value={new Date(order.created_at).toLocaleString()}
            />
            <InfoRow
              icon={Lock}
              label="Pin de Acceso"
              value={(order.access_pin ? `${order.access_pin}` : "No disponible")}
            />

            </div>
            {order.access_pin && showSharePortalAction && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={onSharePortalLink}>
                  <LinkIcon /> Compartir enlace
                </Button>
                <Button variant="outline" size="sm" onClick={onSharePdfDirectLink} data-tour="share-pdf">
                  <LinkIcon /> Compartir PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showDocumentActions && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Constancias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start py-6" onClick={onGenerateCertificate}>
            <FileText className="mr-2 h-4 w-4" />
            <span className="whitespace-normal">Generar Constancia Paciente</span>
          </Button>

          <Button variant="outline" className="w-full justify-start py-6" onClick={onGenerateCompanionCertificate}>
            <FileText className="mr-2 h-4 w-4" />
            <span className="whitespace-normal">Generar Constancia Acompañante</span>
          </Button>

           <Button variant="outline" className="w-full justify-start py-6" onClick={onGenerateLetterHead} >
              <FileText className="mr-2 h-4 w-4" />
              <span className="whitespace-normal">Ver Carta</span>
          </Button>
        </CardContent>
      </Card>
      )}

    </div>
  );
});


/** Screen casing only; PDF documents format names on their own. */
const toTitleCase = (value: string) => value.toLocaleLowerCase("es").replace(/(^|\s)\p{L}/gu, (match) => match.toLocaleUpperCase("es"));

function InfoRow({
  icon: Icon,
  label,
  value,
  iconClassName,
  valueClassName,
}: {
  icon: typeof User;
  label: string;
  value: string;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg neu-inset ${iconClassName ?? "text-primary"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${valueClassName ?? ""}`}>{value}</p>
      </div>
    </div>
  );
}

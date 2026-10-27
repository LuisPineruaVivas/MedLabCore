import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, FileText, IdCard, Link as LinkIcon, Mail, Phone, User } from "lucide-react";
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
          <CardTitle className="text-base">Datos del Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <InfoRow icon={User} label="Paciente" value={patientInfo.name} />
            <InfoRow icon={IdCard} label="Cédula" value={patientInfo.id} />
            <InfoRow
              icon={Calendar}
              label="Edad / Género"
              value={`${patientInfo.age} ${typeof patientInfo.age === "number" ? "años" : ""} / ${patientInfo.gender}`}
            />
            <InfoRow icon={Phone} label="Telefono" value={order.patients.phone || "No registrado"} />
            <InfoRow icon={Mail} label="Correo" value={order.patients.email || "No registrado"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos de la Orden</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-t border-border pt-3">
              <InfoRow
              icon={DollarSign}
              label="Total USD"
              value={`$${Number(order.total_amount).toFixed(2)}`}
              iconClassName="bg-success/10 text-success"
              valueClassName="font-semibold mono"
            />
            {order.total_bs != null && (
              <InfoRow
                icon={DollarSign}
                label="Total BS"
                value={`Bs. ${Number(order.total_bs).toFixed(2)}`}
                iconClassName="bg-muted text-muted-foreground"
                valueClassName="font-medium mono"
              />
            )}
            </div>
            {order.access_pin && showSharePortalAction && (
              <div className="flex items-center justify-between border-t border-border pt-2">
                <Button variant="ghost" size="sm" onClick={onSharePortalLink}>
                  Compartir <LinkIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onSharePdfDirectLink}>
                  Compartir pdf<LinkIcon className="h-4 w-4" />
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
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${iconClassName ?? "text-primary"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${valueClassName ?? ""}`}>{value}</p>
      </div>
    </div>
  );
}

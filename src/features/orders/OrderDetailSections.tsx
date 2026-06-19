import { memo, useState } from "react";
import { getFieldResultMeta, sanitizeRangeInput } from "@/features/tests/schemas";
import { getCategoryStyle } from "@/utils/validators";
import type { EditableOrderItem, OrderItemResultsState, OrderResultFieldState, OrderResultSectionState } from "./useOrderResultsEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  DollarSign,
  FileText,
  FlaskConical,
  IdCard,
  Link as LinkIcon,
  Mail,
  Phone,
  Save,
  User,
} from "lucide-react";

type PatientInfo = {
  name: string;
  id: string;
  date: string;
  age: number | string;
  gender: string;
};

type OrganizationInfo = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  city?: string | null;
  rif: string | null;
  profiles?: {
    full_name: string;
  } | null;
};

type ResultField = OrderResultFieldState;
type ResultSection = OrderResultSectionState;
type ItemResultsData = OrderItemResultsState;
type OrderItem = EditableOrderItem & {
  test_name?: string;
  price_at_order?: number;
};

type OrderWithPatient = {
  id: string;
  status: "pendiente" | "por_aprobar" | "procesando" | "completada" | "cancelada";
  total_amount: number;
  total_bs?: number | null;
  access_pin?: string | null;
  patients: {
    phone?: string | null;
    email?: string | null;
  };
};

interface OrderSidebarProps {
  order: OrderWithPatient;
  patientInfo: PatientInfo;
  onSharePortalLink: () => void;
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
                <div>
                  <p className="text-xs text-muted-foreground">PIN de Acceso</p>
                  <p className="mono text-sm font-medium tracking-widest">{order.access_pin}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={onSharePortalLink}>
                  Compartir <LinkIcon className="h-4 w-4" />
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

interface OrderResultsPanelProps {
  groupedItems: Record<string, OrderItem[]>;
  modifiedIds: Set<string>;
  resultsState: Record<string, ItemResultsData>;
  patientInfo: PatientInfo;
  canEnterResults: boolean;
  orderStatus: OrderWithPatient["status"];
  ocrLoading: string | null;
  updateFieldValue: (itemId: string, sectionIdx: number, fieldIdx: number, value: string) => void;
  appendTextOption: (itemId: string, sectionIdx: number, fieldIdx: number, option: string) => void;
  handleFileUploadForOCR: (e: React.ChangeEvent<HTMLInputElement>, categoryItems: OrderItem[], categoryName: string) => void;
}

export const OrderResultsPanel = memo(function OrderResultsPanel({
  groupedItems,
  modifiedIds,
  resultsState,
  patientInfo,
  canEnterResults,
  orderStatus,
  ocrLoading,
  updateFieldValue,
  appendTextOption,
  handleFileUploadForOCR,
}: OrderResultsPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };
  return (
    <>
      {Object.entries(groupedItems).map(([category, itemsInCategory]) => {
        const categoryStats = getCategoryStats(itemsInCategory, resultsState, modifiedIds);
        const isExpanded = expandedCategories[category] !== true;

        return (
          <Card key={category} className={`w-[100%] shrink-0 space-y-6   ${categoryStats.isCategoryModified ? "border-primary/50 shadow-sm" : ""}`}>
            <CardHeader className="pointer-events-auto flex md:flex-row items-center justify-between border-b bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">{category}</CardTitle> 
                {categoryStats.isCategoryModified && (
                  <Badge variant="secondary" className="bg-primary/10 px-1.5 py-0 text-[10px] font-bold uppercase text-primary">
                    Modificado
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {categoryStats.allResultsEntered ? (
                  <span className="flex items-center text-xs font-medium text-success">
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                    Completado
                  </span>
                ) : categoryStats.anyResultsEntered ? (
                  <span className="text-xs font-medium text-amber-500">En Progreso</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Pendiente</span>
                )}
                {!categoryStats.allResultsEntered && canEnterResults && orderStatus !== "completada" && (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      onChange={(event) => handleFileUploadForOCR(event, itemsInCategory, category)}
                      disabled={ocrLoading === category}
                    />
                    <Button variant="outline" size="sm" className="pointer-events-none h-7 px-2 text-xs" disabled={ocrLoading === category}>
                      {ocrLoading === category ? (
                        <span className="animate-pulse">Escaneando...</span>
                      ) : (
                        <>
                          <FileText className="mr-1.5 h-3 w-3" />
                          Autocompletar
                        </>
                      )}
                    </Button>
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => toggleCategory(category)}>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="divide-y divide-primary/50 p-0">
                {itemsInCategory.map((item) => (
                  <OrderResultItemEditor
                    key={item.id}
                    item={item}
                    itemResultsData={resultsState[item.id]}
                    patientInfo={patientInfo}
                    readOnly={orderStatus === "completada" || !canEnterResults}
                    updateFieldValue={updateFieldValue}
                    appendTextOption={appendTextOption}
                  />
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </>
  );
});

interface OrderMobileSaveBarProps {
  modifiedCount: number;
  isSavingAll: boolean;
  onSaveAll: () => void;
}

export const OrderMobileSaveBar = memo(function OrderMobileSaveBar({
  modifiedCount,
  isSavingAll,
  onSaveAll,
}: OrderMobileSaveBarProps) {
  if (modifiedCount === 0) return null;

  return (
    <div className="animate-in fade-in fixed bottom-4 left-1/2 z-50 -translate-x-1/2 slide-in-from-bottom-5">
      <div className="flex items-center gap-4 rounded-full border border-border/50 bg-card px-4 py-2 shadow-xl">
        <span className="hidden whitespace-nowrap text-sm font-medium sm:inline-block">
          {modifiedCount} {modifiedCount === 1 ? "cambio" : "cambios"} sin guardar
        </span>
        <span className="whitespace-nowrap text-sm font-medium sm:hidden">{modifiedCount} cambios</span>
        <Button size="sm" className="rounded-full shadow-md" onClick={onSaveAll} disabled={isSavingAll}>
          <Save className="mr-1.5 h-4 w-4" />
          {isSavingAll ? "Guardando..." : "Guardar Todo"}
        </Button>
      </div>
    </div>
  );
});

export function getCategoryStats(
  itemsInCategory: OrderItem[],
  resultsState: Record<string, ItemResultsData>,
  modifiedIds: Set<string>
) {
  const hasAnyValue = (itemId: string) =>
    resultsState[itemId]?.sections?.some((section) => section.fields?.some((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== ""));

  const hasAllValues = (itemId: string) => {
    const sections = resultsState[itemId]?.sections;
    if (!sections || sections.length === 0) return false;

    let hasFields = false;
    const allFilled = sections.every((section) => {
      const fields = section.fields;
      if (!fields || fields.length === 0) return true;
      hasFields = true;
      return fields.every((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== "");
    });
    return hasFields && allFilled;
  };

  return {
    isCategoryModified: itemsInCategory.some((item) => modifiedIds.has(item.id)),
    allResultsEntered: itemsInCategory.every((item) => hasAllValues(item.id)),
    anyResultsEntered: itemsInCategory.some((item) => hasAnyValue(item.id)),
  };
}

const OrderResultItemEditor = memo(function OrderResultItemEditor({
  item,
  itemResultsData,
  patientInfo,
  readOnly,
  updateFieldValue,
  appendTextOption,
}: {
  item: OrderItem;
  itemResultsData?: ItemResultsData;
  patientInfo: PatientInfo;
  readOnly: boolean;
  updateFieldValue: (itemId: string, sectionIdx: number, fieldIdx: number, value: string) => void;
  appendTextOption: (itemId: string, sectionIdx: number, fieldIdx: number, option: string) => void;
}) {
  if (!itemResultsData) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Estructura de resultados no disponible.</div>;
  }

  return (
    <div className="p-4">
      <div className="space-y-6">
        <h4 className="text-[15px] font-semibold text-foreground">Examen : {item.test_name || ""}</h4>
        {itemResultsData.sections?.map((section, sectionIdx) => (
          <div key={section.id || sectionIdx} className="space-y-3">
            {section.name && (
              <h4 className="border-b border-border pb-1 text-[13px] font-semibold text-foreground">Seccion: {section.name}</h4>
            )}
            <div className="space-y-2 border-l-2 border-border pl-5">
              {section.fields?.map((field, fieldIdx) => (
                <OrderResultFieldRow
                  key={field.id || fieldIdx}
                  itemId={item.id}
                  field={field}
                  sectionIdx={sectionIdx}
                  fieldIdx={fieldIdx}
                  patientInfo={patientInfo}
                  readOnly={readOnly}
                  updateFieldValue={updateFieldValue}
                  appendTextOption={appendTextOption}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function OrderResultFieldRow({
  itemId,
  field,
  sectionIdx,
  fieldIdx,
  patientInfo,
  readOnly,
  updateFieldValue,
  appendTextOption,
}: {
  itemId: string;
  field: ResultField;
  sectionIdx: number;
  fieldIdx: number;
  patientInfo: PatientInfo;
  readOnly: boolean;
  updateFieldValue: (itemId: string, sectionIdx: number, fieldIdx: number, value: string) => void;
  appendTextOption: (itemId: string, sectionIdx: number, fieldIdx: number, option: string) => void;
}) {
  const { rangeDisplay, isOutOfRange, matchedRange } = getFieldResultMeta(
    field,
    patientInfo.gender.toLowerCase(),
    typeof patientInfo.age === "number" ? patientInfo.age : parseInt(String(patientInfo.age), 10) || undefined
  );

  const parsedNumericValue = typeof field.value === "string" ? parseFloat(field.value.replace(",", ".")) : NaN;
  const categoryTextColor = Number.isFinite(parsedNumericValue)
    ? getCategoryStyle(parsedNumericValue, matchedRange)
    : "black";

  return (
    <div className="grid grid-cols-12 items-center gap-3">
      <Label className="col-span-12 text-xs sm:col-span-4 sm:text-sm">
        {field.label}
        {field.unit && <span className="ml-1 text-[10px] text-muted-foreground sm:text-xs">({field.unit})</span>}
      </Label>
      <div className="col-span-12 sm:col-span-5">
        <OrderResultInput
          itemId={itemId}
          field={field}
          sectionIdx={sectionIdx}
          fieldIdx={fieldIdx}
          readOnly={readOnly}
          isOutOfRange={isOutOfRange}
          resultColor={categoryTextColor}
          updateFieldValue={updateFieldValue}
          appendTextOption={appendTextOption}
        />
      </div>
      <div className="col-span-12 text-[10px] text-muted-foreground sm:col-span-3 sm:text-xs">
        {rangeDisplay ? <span>Ref: {rangeDisplay}</span> : null}
      </div>
    </div>
  );
}

function OrderResultInput({
  itemId,
  field,
  sectionIdx,
  fieldIdx,
  readOnly,
  isOutOfRange,
  updateFieldValue,
  appendTextOption,
  resultColor,
}: {
  itemId: string;
  field: ResultField;
  sectionIdx: number;
  fieldIdx: number;
  readOnly: boolean;
  isOutOfRange: boolean;
  resultColor: string;
  updateFieldValue: (itemId: string, sectionIdx: number, fieldIdx: number, value: string) => void;
  appendTextOption: (itemId: string, sectionIdx: number, fieldIdx: number, option: string) => void;
}) {
  if (field.type === "select") {
    return (
      <Select value={field.value || ""} onValueChange={(value) => updateFieldValue(itemId, sectionIdx, fieldIdx, value)} disabled={readOnly}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Seleccionar..." />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const inputTextColor = resultColor === "black" && isOutOfRange ? "#dc2626" : resultColor;

  if (field.type === "number") {
    return (
      <Input
        className={`h-8 text-sm ${isOutOfRange && resultColor === "black" ? "border-destructive/40 text-destructive" : ""}`}
        type="number"
        value={field.value || ""}
        onChange={(event) => updateFieldValue(itemId, sectionIdx, fieldIdx, event.target.value)}
        disabled={readOnly}
        placeholder="Ingresar resultado"
        style={{ color: inputTextColor }}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
      />
    );
  }

  if (field.type === "range") {
    return (
      <Input
        className={`h-8 text-sm ${isOutOfRange && resultColor === "black" ? "border-destructive/40 text-destructive" : ""}`}
        type="text"
        value={field.value || ""}
        onChange={(event) => updateFieldValue(itemId, sectionIdx, fieldIdx, event.target.value)}
        disabled={readOnly}
        placeholder="Ej: >100, <0.5 o Más de 80"
        style={{ color: inputTextColor }}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
      />
    );
  }

  if (field.type === "text") {
    return (
      <div className="flex flex-col gap-1">
        <Textarea
          className="h-20 text-sm"
          value={field.value || ""}
          onChange={(event) => updateFieldValue(itemId, sectionIdx, fieldIdx, event.target.value)}
          disabled={readOnly}
          placeholder="Ingresar resultado"
        />

        {field.options && field.options.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7" disabled={readOnly}>
                Opciones
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
              <p className="mb-2 text-xs text-muted-foreground">Selecciona una o varias opciones para añadir al texto</p>
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {field.options.map((option) => (
                  <Tooltip key={option}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 w-full justify-start truncate text-left"
                        onClick={() => appendTextOption(itemId, sectionIdx, fieldIdx, option)}
                        disabled={readOnly}
                      >
                        {option}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{option}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  return null;
}

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

export function buildLabData(lab: OrganizationInfo | null | undefined) {
  return {
    name: lab?.name || "Laboratorio",
    address: lab?.address || "",
    phone: lab?.phone || "",
    email: lab?.email || "",
    logo: lab?.logo_url || null,
    primary_color: lab?.primary_color || "#0ea5e9",
    secondary_color: lab?.secondary_color || "#0ea5e9",
    ciudad: lab?.city || "",
    rif: lab?.rif || "",
    lab_admin: lab?.profiles[0]?.full_name || ""
  };
}

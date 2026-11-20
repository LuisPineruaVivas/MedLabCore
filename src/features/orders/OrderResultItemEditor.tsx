import { memo } from "react";
import { isMicrobiologyResult, type MicrobiologyResultsData, type SensitivityValue, type AntibiogramEntry } from "@/features/microbiology/types";
import { MicrobiologyResultForm } from "@/features/microbiology/MicrobiologyResultForm";
import { getFieldResultMeta } from "@/features/tests/schemas";
import { getCategoryStyle } from "@/utils/validators";
import type { TestMethod } from "@/features/tests/useTestMethods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import type { PatientInfo, ResultField, ItemResultsData, OrderItem } from "./orderDetailTypes";

export const OrderResultItemEditor = memo(function OrderResultItemEditor({
  item,
  itemResultsData,
  patientInfo,
  readOnly,
  testMethods,
  selectedMethod,
  updateFieldValue,
  appendTextOption,
  updateMethod,
  updateMicroField,
  updateMicroExtraField,
  updateMicroCultureMode,
  updateMicroGerms,
  updateAntibiogram,
  addAntibiogram,
  removeAntibiogram,
}: {
  item: OrderItem;
  itemResultsData?: ItemResultsData;
  patientInfo: PatientInfo;
  readOnly: boolean;
  testMethods: TestMethod[];
  selectedMethod: { id: string; name: string } | null | undefined;
  updateFieldValue: (itemId: string, sectionIdx: number, fieldIdx: number, value: string) => void;
  appendTextOption: (itemId: string, sectionIdx: number, fieldIdx: number, option: string) => void;
  updateMethod: (itemId: string, method: { id: string; name: string } | null) => void;
  updateMicroField: (itemId: string, field: keyof Omit<MicrobiologyResultsData, 'result_type' | 'antibiogram' | 'isolated_germs'>, value: string) => void;
  updateMicroExtraField: (itemId: string, key: string, value: string) => void;
  updateMicroCultureMode?: (itemId: string, mode: "text" | "germs") => void;
  updateMicroGerms: (itemId: string, germs: string[]) => void;
  updateAntibiogram: (itemId: string, antibioticIdx: number, sensitivity: SensitivityValue, germIndex?: number) => void;
  addAntibiogram: (itemId: string, entry: AntibiogramEntry) => void;
  removeAntibiogram: (itemId: string, antibioticId: string) => void;
}) {
  if (!itemResultsData) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Estructura de resultados no disponible.</div>;
  }

  if (isMicrobiologyResult(itemResultsData)) {
    return (
      <div className="border-b last:border-b-0 pb-6 mb-6 last:mb-0 last:pb-0">
        <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-base font-semibold">{item.test_name || "Examen"}</h4>
        </div>
        <MicrobiologyResultForm
          itemId={item.id}
          itemResultsData={itemResultsData as MicrobiologyResultsData}
          readOnly={readOnly}
          templateSchema={item.template_schema}
          updateMicroField={updateMicroField}
          updateMicroExtraField={updateMicroExtraField}
          updateMicroCultureMode={updateMicroCultureMode}
          updateMicroGerms={updateMicroGerms}
          updateAntibiogram={updateAntibiogram}
          addAntibiogram={addAntibiogram}
          removeAntibiogram={removeAntibiogram}
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-base font-semibold">{item.test_name || "Examen"}</h4>
          {!readOnly || selectedMethod ? (
            <Select
              value={selectedMethod?.id ?? "__none__"}
              onValueChange={(methodId) => {
                if (methodId === "__none__") {
                  updateMethod(item.id, null);
                  return;
                }
                const method = testMethods.find((candidate) => candidate.id === methodId);
                if (method) updateMethod(item.id, { id: method.id, name: method.name });
              }}
              disabled={readOnly}
            >
              <SelectTrigger className="h-8 w-[210px] text-xs"><SelectValue placeholder="Agregar método" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin método</SelectItem>
                {testMethods.map((method) => <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {itemResultsData.sections?.map((section, sectionIdx) => (
          <div key={section.id || sectionIdx} className="space-y-3">
            {section.name && (
              <h5 className="border-b border-border pb-1 text-sm font-semibold text-muted-foreground">{section.name}</h5>
            )}
            <div className="space-y-3">
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
    // Label | value pressed into a well | reference range, kept together (the label column is capped) so the eye
    // doesn't travel across a wide screen; the value is the largest thing on the row.
    <div className={`grid ${field.type !== 'text' ? 'grid-cols-[minmax(0,1fr)_minmax(7rem,9rem)] sm:grid-cols-[minmax(8rem,18rem)_10rem_minmax(8rem,1fr)]' : 'grid-cols-1'} items-center gap-x-4 gap-y-1`}>
      <Label htmlFor={`result-${itemId}-${sectionIdx}-${fieldIdx}`} className="text-sm font-medium">
        {field.label}
        {field.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">({field.unit})</span>}
      </Label>
      <div>
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
      {field.type !== "text" && (
        <div className="col-span-2 text-xs text-muted-foreground tabular-nums sm:col-span-1 sm:text-sm">
          {rangeDisplay ? <span className="whitespace-nowrap">Ref. {rangeDisplay}</span> : null}
          {isOutOfRange && <span className="block whitespace-nowrap font-semibold text-destructive">Fuera de rango</span>}
        </div>
      )}
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
        <SelectTrigger id={`result-${itemId}-${sectionIdx}-${fieldIdx}`} className="h-11 text-sm font-semibold shadow-[var(--neu-inset)]">
          <SelectValue placeholder="Seleccionar" />
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

  // A lab-defined category color wins; otherwise the theme's text color, or destructive when out of range
  // ("black" is the helper's no-category default and would vanish in dark mode).
  const inputTextColor = resultColor === "black" ? undefined : resultColor;
  const inputId = `result-${itemId}-${sectionIdx}-${fieldIdx}`;
  // Read-only results read as recorded values, not inputs: flat, no placeholder, full contrast.
  const wellClass = `h-11 text-right text-lg font-semibold tabular-nums placeholder:text-sm placeholder:font-normal disabled:cursor-default disabled:opacity-100 disabled:border-transparent disabled:bg-transparent disabled:shadow-none ${isOutOfRange && !inputTextColor ? "border-destructive text-destructive" : ""}`;

  if (field.type === "number") {
    return (
      <Input
        id={inputId}
        className={wellClass}
        aria-invalid={isOutOfRange || undefined}
        type={readOnly ? "text" : "number"}
        value={readOnly ? field.value || "—" : field.value || ""}
        onChange={(event) => updateFieldValue(itemId, sectionIdx, fieldIdx, event.target.value)}
        disabled={readOnly}
        placeholder={readOnly ? undefined : "Resultado"}
        style={{ color: inputTextColor }}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
      />
    );
  }

  if (field.type === "range") {
    return (
      <Input
        id={inputId}
        className={wellClass}
        aria-invalid={isOutOfRange || undefined}
        type="text"
        value={readOnly ? field.value || "—" : field.value || ""}
        onChange={(event) => updateFieldValue(itemId, sectionIdx, fieldIdx, event.target.value)}
        disabled={readOnly}
        placeholder={readOnly ? undefined : "Ej.: >100"}
        style={{ color: inputTextColor }}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
      />
    );
  }

  if (field.type === "text") {
    return (
      <div className="flex flex-col gap-1.5">
        <Textarea
          className="min-h-[110px] h-40  max-w-xl text-sm whitespace-pre-wrap font-sans"
          value={field.value || ""}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const textarea = e.currentTarget;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const tabSpaces = "    ";
              const val = textarea.value;
              const nextVal = val.substring(0, start) + tabSpaces + val.substring(end);
              updateFieldValue(itemId, sectionIdx, fieldIdx, nextVal);
              requestAnimationFrame(() => {
                textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length;
              });
            }
          }}
          onChange={(event) => updateFieldValue(itemId, sectionIdx, fieldIdx, event.target.value)}
          disabled={readOnly}
          placeholder="Ingresar resultado"
        />

        {field.options && field.options.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 w-fit gap-1 text-xs" disabled={readOnly}>
                <FileText className="h-3.5 w-3.5 text-primary" />
                Plantillas / Opciones ({field.options.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-3" align="start">
              <p className="mb-2 text-xs font-medium text-foreground">
                Selecciona una plantilla o añade opciones al texto:
              </p>
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                {field.options.map((option, idx) => {
                  const firstLine = option.split("\n")[0].trim();
                  const isMultiline = option.includes("\n");

                  return (
                    <div key={idx} className="rounded-md border p-2 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold truncate flex-1" title={firstLine}>
                          {firstLine || `Plantilla ${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => updateFieldValue(itemId, sectionIdx, fieldIdx, option)}
                            disabled={readOnly}
                            title="Reemplaza todo el contenido del campo con esta plantilla"
                          >
                            Cargar
                          </Button>
                          {field.value && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => appendTextOption(itemId, sectionIdx, fieldIdx, option)}
                              disabled={readOnly}
                              title="Añade esta plantilla al final del texto actual"
                            >
                              + Añadir
                            </Button>
                          )}
                        </div>
                      </div>
                      {isMultiline ? (
                        <p className="line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-background/80 p-1.5 rounded border border-border/50">
                          {option}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  return null;
}

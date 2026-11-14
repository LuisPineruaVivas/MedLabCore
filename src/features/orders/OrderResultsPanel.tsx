import { memo, useState } from "react";
import type { MicrobiologyResultsData, SensitivityValue, AntibiogramEntry } from "@/features/microbiology/types";
import type { TestMethod } from "@/features/tests/useTestMethods";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, ClipboardCheck, FileText, FlaskConical, Save } from "lucide-react";
import type { PatientInfo, ItemResultsData, OrderItem, OrderWithPatient } from "./orderDetailTypes";
import { getCategoryStats } from "./orderSectionsUtils";
import { OrderResultItemEditor } from "./OrderResultItemEditor";

interface OrderResultsPanelProps {
  groupedItems: Record<string, OrderItem[]>;
  modifiedIds: Set<string>;
  resultsState: Record<string, ItemResultsData>;
  patientInfo: PatientInfo;
  canEnterResults: boolean;
  orderStatus: OrderWithPatient["status"];
  ocrLoading: string | null;
  testMethods: TestMethod[];
  selectedMethods: Record<string, { id: string; name: string } | null>;
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
  testMethods,
  selectedMethods,
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
                  <Badge variant="secondary" className="bg-primary/10 px-1.5 py-0 text-xs font-bold uppercase text-primary">
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
                  <span className="text-xs font-medium text-warning">En Progreso</span>
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
                    testMethods={testMethods}
                    selectedMethod={selectedMethods[item.id]}
                    updateFieldValue={updateFieldValue}
                    appendTextOption={appendTextOption}
                    updateMethod={updateMethod}
                    updateMicroField={updateMicroField}
                    updateMicroExtraField={updateMicroExtraField}
                    updateMicroCultureMode={updateMicroCultureMode}
                    updateMicroGerms={updateMicroGerms}
                    updateAntibiogram={updateAntibiogram}
                    addAntibiogram={addAntibiogram}
                    removeAntibiogram={removeAntibiogram}
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
  /** The action that moves the order forward (e.g. Aprobar y firmar); kept in reach on phones. */
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean } | null;
}

export const OrderMobileSaveBar = memo(function OrderMobileSaveBar({
  modifiedCount,
  isSavingAll,
  onSaveAll,
  primaryAction,
}: OrderMobileSaveBarProps) {
  const changes = `${modifiedCount} ${modifiedCount === 1 ? "cambio" : "cambios"} sin guardar`;
  return (
    <>
      {/* Phone: fixed above the bottom navigation, so approving never scrolls out of reach. */}
      {(primaryAction || modifiedCount > 0) && (
        <div className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-40 md:hidden">
          <div className="flex items-center gap-2 rounded-2xl border bg-popover p-2 shadow-[var(--shadow-elevated)]">
            {modifiedCount > 0 && (
              <Button variant="outline" size="sm" className="flex-1" onClick={onSaveAll} disabled={isSavingAll} aria-label={`Guardar: ${changes}`}>
                <Save />
                {isSavingAll ? "Guardando…" : `Guardar (${modifiedCount})`}
              </Button>
            )}
            {primaryAction && (
              <Button size="sm" className="flex-1" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                {primaryAction.label}
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Desktop: the header carries the actions; a floating reminder appears only with unsaved changes. */}
      {modifiedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 hidden -translate-x-1/2 md:block">
          <div className="flex items-center gap-4 rounded-full border bg-popover px-4 py-2 shadow-[var(--shadow-elevated)]">
            <span className="whitespace-nowrap text-sm font-medium">{changes}</span>
            <Button size="sm" className="rounded-full" onClick={onSaveAll} disabled={isSavingAll}>
              <Save />
              {isSavingAll ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
});

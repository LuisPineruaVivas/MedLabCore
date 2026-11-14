import { differenceInYears, differenceInMonths, format } from "date-fns";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { isDemo } from "@/lib/demo/isDemo";
import type { EditableOrderItem, OrderItemResultsState } from "./useOrderResultsEditor";

type OrderPatient = {
  first_name: string;
  last_name: string;
  id_number: string;
  date_of_birth: string;
  gender: string;
};

type OrderLike = {
  id: string;
  order_seq: number;
  created_at: string;
  total_amount: number;
  total_bs?: number | null;
  access_pin?: string | null;
  exchange_rate?: number | null;
  patients: OrderPatient;
};

type LabData = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
  primary_color?: string;
  secondary_color?: string;
};

export function buildOrderPatientInfo(order: OrderLike) {
  return {
    name: `${order.patients.first_name} ${order.patients.last_name}`.toUpperCase(),
    id: order.patients.id_number,
    date: format(new Date(order.created_at), "dd/MM/yyyy"),
    age: order.patients.date_of_birth
      ? differenceInYears(new Date(), new Date(order.patients.date_of_birth)) > 0 
        ? `${differenceInYears(new Date(), new Date(order.patients.date_of_birth))} Años`
        : `${differenceInMonths(new Date(), new Date(order.patients.date_of_birth))} Meses`
        : "N/A",
    gender: order.patients.gender || "N/A",
  };
}

export function buildThermalReceiptData(
  order: OrderLike,
  orderItems: Array<EditableOrderItem & { test_name?: string; price_at_order?: number }>,
  patientInfo: { name: string; id: string, age: string | number, gender: string },
  labData: LabData,
  origin: string
): ThermalReceiptData {
  return {
    orderId: order.order_seq,
    orderDate: format(new Date(order.created_at), "dd/MM/yyyy HH:mm"),
    patientName: patientInfo.name,
    patientId: patientInfo.id,
    age: patientInfo.age,
    gender: patientInfo.gender,  
    items: orderItems
      .filter((item) => Number(item.price_at_order) > 0)
      .map((item) => ({ test_name: item.test_name || "", price: Number(item.price_at_order) })),
    total: Number(order.total_amount),
    accessPin: order.access_pin,
    portalUrl: `${origin}/portal-paciente`,
    // != null keeps 0 (exempted orders) as 0 instead of turning it into "unknown".
    exchangeRate: order.exchange_rate != null ? Number(order.exchange_rate) : null,
    totalBs: order.total_bs != null ? Number(order.total_bs) : null,
    labData,
  };
}

/** Spanish message for a failed "Guardar todo" (nothing is saved when it fails). */
export function getSaveResultsErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "");
  if (message.includes("ORDER_RESULTS_LOCKED")) {
    return "La orden esta completada o cancelada: sus resultados ya no se pueden modificar.";
  }
  if (message.includes("ORDER_ITEMS_NOT_FOUND")) {
    return "Algunos examenes ya no existen en esta orden. Recarga la pagina e intenta de nuevo.";
  }
  return "No se pudieron guardar los resultados. No se guardo ningun cambio; intenta de nuevo.";
}

export function isMobileDevice() {
  // The demo keeps reports and receipts in in-app dialogs: its presentation cannot open new tabs.
  return (
    !isDemo &&
    typeof window !== "undefined" &&
    (window.matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  );
}

export function collectOcrFieldLabels(
  categoryItems: EditableOrderItem[],
  resultsState: Record<string, OrderItemResultsState>
) {
  const fieldsToExtract: string[] = [];

  categoryItems.forEach((item) => {
    resultsState[item.id]?.sections?.forEach((section) => {
      section.fields?.forEach((field) => {
        if (
          (field.type === "number" || field.type === "text" || field.type === "range") &&
          (!field.value || String(field.value).trim() === "")
        ) {
          fieldsToExtract.push(field.label);
        }
      });
    });
  });

  return fieldsToExtract;
}

export function applyOcrResultsToState(
  categoryItems: EditableOrderItem[],
  resultsState: Record<string, OrderItemResultsState>,
  extractedResults: Record<string, unknown>,
  updateFieldValue: (itemId: string, sectionIdx: number, fieldIdx: number, value: string) => void
) {
  let fieldsUpdated = 0;

  categoryItems.forEach((item) => {
    const itemResultsData = resultsState[item.id];
    if (!itemResultsData?.sections) return;

    itemResultsData.sections.forEach((section, sectionIdx) => {
      section.fields?.forEach((field, fieldIdx) => {
        const aiValue = extractedResults[field.label];
        if (aiValue !== undefined && aiValue !== null) {
          let valueToSet = aiValue.toString().trim();

          if (field.type === "number") {
            const match = valueToSet.match(/^[-+]?\d+(?:[.,]\d+)?/);
            if (match) {
              valueToSet = match[0].replace(",", ".");
            }
          } else if (field.type === "range") {
            const match = valueToSet.match(/^([<>]=?)?\s*\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?/);
            if (match) {
              valueToSet = match[0].replace(",", ".").replace(/\s+/g, "");
            }
          }

          updateFieldValue(item.id, sectionIdx, fieldIdx, valueToSet);
          fieldsUpdated += 1;
        }
      });
    });
  });

  return fieldsUpdated;
}

export function canApproveAndSignOrder(
  profile?: { firma_url?: string | null; sello_url?: string | null } | null
): boolean {
  return Boolean(profile?.firma_url || profile?.sello_url);
}


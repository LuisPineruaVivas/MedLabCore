import { differenceInYears, format } from "date-fns";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
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
      ? differenceInYears(new Date(), new Date(order.patients.date_of_birth))
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
    exchangeRate: order.exchange_rate ? Number(order.exchange_rate) : null,
    totalBs: order.total_bs ? Number(order.total_bs) : null,
    labData,
  };
}

export function isMobileDevice() {
  return (
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
          updateFieldValue(item.id, sectionIdx, fieldIdx, aiValue.toString());
          fieldsUpdated += 1;
        }
      });
    });
  });

  return fieldsUpdated;
}

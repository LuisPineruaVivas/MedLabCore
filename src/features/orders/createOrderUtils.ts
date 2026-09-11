import { differenceInYears, format } from "date-fns";

export interface OrderTemplateSearchRecord {
  id: string;
  name: string;
  category: string;
  base_price: number | string;
  schema: unknown;
}

export interface OrderProfileTemplateRecord {
  id: string;
  name: string;
  category: string;
  base_price?: number | string | null;
  schema: unknown;
}

export interface OrderProfileSearchRecord {
  id: string;
  name: string;
  description: string | null;
  total_price: number | string;
  profile_templates_junction?: Array<{
    test_templates?: OrderProfileTemplateRecord | null;
  }> | null;
}

export type SearchItem =
  | {
      type: "exam";
      id: string;
      name: string;
      category: string;
      price: number;
      schema: unknown;
    }
  | {
      type: "profile";
      id: string;
      name: string;
      description: string | null;
      price: number;
      templateCount: number;
      templates: OrderProfileTemplateRecord[];
    };

export interface CartItem {
  template_id: string | null;
  test_name: string;
  category: string;
  price: number;
  schema: unknown;
  isProfileHeader?: boolean;
  profileId?: string;
  parentProfileId?: string;
}

type SelectedPatient = {
  first_name: string;
  last_name: string;
  id_number: string;
  date_of_birth?: string | null;
  gender?: string | null;
};

export interface OrderReceiptData {
  orderId: string;
  orderDate: string;
  patientName: string;
  patientId: string;
  age: string | number;
  gender: string;
  items: Array<{ test_name: string; price: number }>;
  total: number;
  accessPin?: string | null;
  exchangeRate?: number | null;
  totalBs?: number | null;
  order_seq: number | null;
}

export function buildSearchItems(
  templates: OrderTemplateSearchRecord[],
  examProfiles: OrderProfileSearchRecord[]
): SearchItem[] {
  const exams: SearchItem[] = templates.map((template) => ({
    type: "exam",
    id: template.id,
    name: template.name,
    category: template.category,
    price: Number(template.base_price),
    schema: template.schema,
  }));

  const profiles: SearchItem[] = examProfiles.map((profile) => ({
    type: "profile",
    id: profile.id,
    name: profile.name,
    description: profile.description,
    price: Number(profile.total_price),
    templateCount: profile.profile_templates_junction?.length ?? 0,
    templates: (profile.profile_templates_junction ?? [])
      .map((junction) => junction.test_templates)
      .filter((template): template is OrderProfileTemplateRecord => Boolean(template)),
  }));

  return [...profiles, ...exams];
}

export function filterSearchItems(items: SearchItem[], search: string) {
  if (!search.trim()) {
    return items;
  }

  const query = search.toLowerCase();
  return items.filter((item) =>
    item.name.toLowerCase().includes(query) ||
    (item.type === "exam" && item.category.toLowerCase().includes(query))
  );
}

export function addSearchItemToCart(cart: CartItem[], item: SearchItem) {
  if (item.type === "exam") {
    if (cart.some((cartItem) => cartItem.template_id === item.id && !cartItem.parentProfileId)) {
      return cart;
    }

    return [
      ...cart,
      {
        template_id: item.id,
        test_name: item.name,
        category: item.category,
        price: item.price,
        schema: item.schema,
      },
    ];
  }

  if (cart.some((cartItem) => cartItem.isProfileHeader && cartItem.profileId === item.id)) {
    return cart;
  }

  const profileId = item.id;
  const headerItem: CartItem = {
    template_id: null,
    test_name: item.name,
    category: "Perfil",
    price: item.price,
    schema: null,
    isProfileHeader: true,
    profileId,
  };
  const childItems: CartItem[] = item.templates.map((template) => ({
    template_id: template.id,
    test_name: template.name,
    category: template.category,
    price: 0,
    schema: template.schema,
    parentProfileId: profileId,
  }));

  return [...cart, headerItem, ...childItems];
}

export function removeCartItem(cart: CartItem[], item: CartItem) {
  if (item.isProfileHeader && item.profileId) {
    return cart.filter(
      (cartItem) =>
        cartItem.profileId !== item.profileId && cartItem.parentProfileId !== item.profileId
    );
  }

  if (item.parentProfileId) {
    return cart;
  }

  return cart.filter(
    (cartItem) => cartItem.template_id !== item.template_id || Boolean(cartItem.parentProfileId)
  );
}

export function calculateCartTotal(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.price, 0);
}

export function calculateCartTotalBs(total: number, exchangeRate?: number | null) {
  if (!exchangeRate) {
    return null;
  }

  return total * exchangeRate;
}

export function resolveOrderTotals(
  total: number,
  totalBs: number | null,
  isExempted: boolean
) {
  if (!isExempted) {
    return {
      total,
      totalBs,
    };
  }

  return {
    total: 0,
    totalBs: totalBs === null ? null : 0,
  };
}

export function buildOrderReceiptData(params: {
  orderId: string;
  order_seq: number | null;
  selectedPatient: SelectedPatient;
  cart: CartItem[];
  total: number;
  exchangeRate?: number | null;
  totalBs?: number | null;
  accessPin?: string | null;
  now?: Date;
}) {
  const { orderId, order_seq, selectedPatient, cart, total, exchangeRate, totalBs, accessPin, now } = params;

  return {
    orderId,
    order_seq,
    orderDate: format(now ?? new Date(), "dd/MM/yyyy HH:mm"),
    patientName: `${selectedPatient.first_name} ${selectedPatient.last_name}`.toUpperCase(),
    patientId: selectedPatient.id_number,
    age: differenceInYears(new Date(), new Date(selectedPatient.date_of_birth ?? "")),
    gender: selectedPatient.gender,
    items: cart
      .filter((item) => item.price > 0)
      .map((item) => ({ test_name: item.test_name, price: item.price })),
    total,
    accessPin,
    exchangeRate: exchangeRate ?? null,
    totalBs: totalBs ?? null,
  } satisfies OrderReceiptData;
}

export function buildSelectedPatientSummary(patient: SelectedPatient) {
  const parts = [`ID: ${patient.id_number}`];

  if (patient.date_of_birth) {
    parts.push(`${differenceInYears(new Date(), new Date(patient.date_of_birth))} años`);
  }

  if (patient.gender) {
    parts.push(patient.gender);
  }

  return parts.join(" · ");
}

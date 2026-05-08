export interface ThermalReceiptItem {
  test_name: string;
  price: number;
}

export interface ThermalReceiptLabData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
  primary_color?: string;
}

export interface ThermalReceiptData {
  orderId: number | string;
  orderDate: string;
  patientName: string;
  patientId: string;
  age: string | number;
  gender: string;
  items: ThermalReceiptItem[];
  total: number;
  accessPin?: string | null;
  portalUrl?: string;
  exchangeRate?: number | null;
  totalBs?: number | null;
  labData?: ThermalReceiptLabData;
}

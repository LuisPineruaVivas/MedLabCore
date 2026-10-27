import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import { OrderReceiptPDF } from "@/lib/orderReceiptPDF";
import { OrderBudgetPDF } from "@/lib/orderBudgetPDF";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import type { PatientFormData } from "../patients/schemas";
import { useCreatePatient, usePatientSearch } from "../patients/usePatients";
import { useOrderProfiles, useOrderTemplates } from "../tests/useTestTemplates";
import { useCreateOrder } from "./useOrders";
import {
  addSearchItemToCart,
  buildOrderBudgetData,
  buildOrderReceiptData,
  buildSearchItems,
  calculateCartTotal,
  calculateCartTotalBs,
  type CartItem,
  filterSearchItems,
  removeCartItem,
  resolveOrderTotals,
  type SearchItem,
} from "./createOrderUtils";

export type SelectedPatient = {
  id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  date_of_birth?: string | null;
  gender?: string | null;
};

export type CreateOrderLabData = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
  primary_color?: string;
};

function isMobileReceiptFlow() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  );
}

/** State and actions of the new-order dialog: patient, cart, totals, create, receipt, budget. */
export function useCreateOrderDialog({
  onOpenChange,
  onSuccess,
  labData,
}: {
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  labData?: CreateOrderLabData;
}) {
  const { orgId, user, role } = useCurrentOrgContext();
  const { isErpEnabled, canRegisterPayments } = useErpModule();
  const createOrder = useCreateOrder();
  const queryClient = useQueryClient();
  const { data: exchangeRateData } = useExchangeRate(orgId);
  const currentRate = exchangeRateData?.rate ? Number(exchangeRateData.rate) : null;

  const [patientSearch, setPatientSearch] = useState("");
  const debouncedSearch = useDebounce(patientSearch, 500);
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [testSearch, setTestSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isExempted, setIsExempted] = useState(false);
  const [receiptData, setReceiptData] = useState<ReturnType<typeof buildOrderReceiptData> | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [isGeneratingBudget, setIsGeneratingBudget] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: patients = [], isFetching: searchingPatients } = usePatientSearch(debouncedSearch);
  const { data: templates = [] } = useOrderTemplates();
  const { data: examProfiles = [] } = useOrderProfiles();
  const canExemptOrder = role !== "lab_affiliate";

  const allSearchItems = useMemo(
    () => buildSearchItems(templates, examProfiles),
    [templates, examProfiles]
  );
  const filteredItems = useMemo(
    () => filterSearchItems(allSearchItems, testSearch),
    [allSearchItems, testSearch]
  );
  const total = useMemo(() => calculateCartTotal(cart), [cart]);
  const totalBs = useMemo(() => calculateCartTotalBs(total, currentRate), [currentRate, total]);
  const effectiveTotals = useMemo(
    () => resolveOrderTotals(total, totalBs, isExempted),
    [isExempted, total, totalBs]
  );

  function addToCart(item: SearchItem) {
    setCart((previousCart) => addSearchItemToCart(previousCart, item));
  }

  function handleRemoveCartItem(item: CartItem) {
    setCart((previousCart) => removeCartItem(previousCart, item));
  }

  function resetDialog() {
    setPatientSearch("");
    setSelectedPatient(null);
    setShowQuickRegister(false);
    setTestSearch("");
    setCart([]);
    setReceiptData(null);
    setNotes("");
    setIsExempted(false);
    setCreatedInvoiceId(null);
    setPaymentOpen(false);
  }

  const createMutation = useCreatePatient();

  const createPatientMutation = useMutation({
    mutationFn: async (formData: PatientFormData) => {
      await createMutation.mutateAsync(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.all(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.search(orgId, debouncedSearch) });
      toast.success("Paciente creado correctamente");
    },
    onError: (error: Error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo crear el paciente"));
    },
  });

  async function handleCreateOrder() {
    if (!selectedPatient || !orgId || !user?.id || cart.length === 0) {
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        orgId,
        patientId: selectedPatient.id,
        createdBy: user.id,
        items: cart.map((item) => ({
          template_id: item.template_id,
          test_name: item.test_name,
          price: item.price,
          schema: item.schema,
          isProfileHeader: item.isProfileHeader,
          profileId: item.profileId,
          parentProfileId: item.parentProfileId,
        })),
        notes: notes.trim() || null,
        exchangeRate: currentRate,
        totalBs: effectiveTotals.totalBs,
        isExempted,
      });

      toast.success("Orden creada correctamente");
      const invoiceId = (order as { invoiceId?: string | null }).invoiceId ?? null;
      setCreatedInvoiceId(invoiceId);

      const generatedReceiptData = buildOrderReceiptData({
        orderId: String((order as { orderId?: string }).orderId),
        order_seq: (order as { order_seq?: number | null }).order_seq,
        selectedPatient,
        cart,
        total: effectiveTotals.total,
        accessPin: (order as { access_pin?: string | null }).access_pin,
        exchangeRate: currentRate,
        totalBs: effectiveTotals.totalBs,
      });

      if (role === "lab_affiliate") {
        resetDialog();
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      if (isMobileReceiptFlow()) {
        const receiptBlob = await pdf(
          <OrderReceiptPDF
            orderId={generatedReceiptData.orderId}
            orderDate={generatedReceiptData.orderDate}
            patientName={generatedReceiptData.patientName}
            patientId={generatedReceiptData.patientId}
            items={generatedReceiptData.items}
            total={generatedReceiptData.total}
            accessPin={generatedReceiptData.accessPin}
            portalUrl={`${window.location.origin}/portal-paciente`}
            labData={labData}
            exchangeRate={generatedReceiptData.exchangeRate}
            totalBs={generatedReceiptData.totalBs}
          />
        ).toBlob();

        const url = URL.createObjectURL(receiptBlob);
        window.open(url, "_blank");
        setReceiptData(null);
        onOpenChange(false);
      } else {
        setReceiptData(generatedReceiptData);
      }

      onSuccess?.();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "No se pudo crear la orden"));
    }
  }

  async function handleThermalPrint() {
    if (!receiptData) {
      return;
    }

    setThermalPrinting(true);
    try {
      const thermalData: ThermalReceiptData = {
        ...receiptData,
        portalUrl: `${window.location.origin}/portal-paciente`,
        labData,
      };

      await printThermalReceipt(thermalData);
      toast.success("Recibo enviado a la impresora termica");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo imprimir el recibo";
      toast.error(message);
    } finally {
      setThermalPrinting(false);
    }
  }

  async function handleGenerateBudget() {
    if (cart.length === 0) {
      return;
    }

    setIsGeneratingBudget(true);

    const pdfWindow = window.open("", "_blank");
    if (pdfWindow) {
      pdfWindow.document.title = "Generando Presupuesto...";
      pdfWindow.document.body.innerHTML =
        "<div style='display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#475569;'>Generando documento de presupuesto...</div>";
    }

    try {
      const budgetData = buildOrderBudgetData({
        selectedPatient,
        cart,
        total: effectiveTotals.total,
        exchangeRate: currentRate,
        totalBs: effectiveTotals.totalBs,
        notes,
      });

      const budgetBlob = await pdf(
        <OrderBudgetPDF
          budgetDate={budgetData.budgetDate}
          patientName={budgetData.patientName}
          patientId={budgetData.patientId}
          items={budgetData.items}
          total={budgetData.total}
          labData={labData}
          exchangeRate={budgetData.exchangeRate}
          totalBs={budgetData.totalBs}
          notes={budgetData.notes}
        />
      ).toBlob();

      const url = URL.createObjectURL(budgetBlob);
      if (pdfWindow) {
        pdfWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } catch (error) {
      if (pdfWindow) {
        pdfWindow.close();
      }
      toast.error(getUserFacingErrorMessage(error, "No se pudo generar el presupuesto"));
    } finally {
      setIsGeneratingBudget(false);
    }
  }

  return {
    isErpEnabled,
    canRegisterPayments,
    createOrder,
    currentRate,
    patientSearch,
    setPatientSearch,
    selectedPatient,
    setSelectedPatient,
    showQuickRegister,
    setShowQuickRegister,
    testSearch,
    setTestSearch,
    cart,
    notes,
    setNotes,
    isExempted,
    setIsExempted,
    receiptData,
    thermalPrinting,
    isGeneratingBudget,
    createdInvoiceId,
    paymentOpen,
    setPaymentOpen,
    patients,
    searchingPatients,
    canExemptOrder,
    filteredItems,
    total,
    totalBs,
    effectiveTotals,
    addToCart,
    handleRemoveCartItem,
    resetDialog,
    createPatientMutation,
    handleCreateOrder,
    handleThermalPrint,
    handleGenerateBudget,
  };
}

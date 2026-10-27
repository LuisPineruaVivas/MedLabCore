import { useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { OrderItemResultsState, SelectedMethod, useOrderResultsEditor } from "./useOrderResultsEditor";
import { useSaveResults, useUpdateOrderStatus } from "./useOrders";
import type { OrderItem } from "./orderDetailTypes";
import { applyOcrResultsToState, canApproveAndSignOrder, collectOcrFieldLabels, getSaveResultsErrorMessage } from "./orderDetailUtils";
import { getOrderStatusAction } from "./orderWorkflow";

type Editor = ReturnType<typeof useOrderResultsEditor>;
type Profile = Parameters<typeof canApproveAndSignOrder>[0] & {
  full_name?: string | null;
  firma_url?: string | null;
  sello_url?: string | null;
  signature_footer_text?: string | null;
};

/**
 * Results entry actions of the order detail page: "Guardar Todos" (one request,
 * all-or-nothing), OCR autofill, and moving the order forward (ready → approve & sign).
 */
export function useOrderResultsActions({
  order,
  role,
  profile,
  isErpEnabled,
  editor,
}: {
  order: { id: string; org_id: string; status: string } | null | undefined;
  role: string | null | undefined;
  profile: Profile | null | undefined;
  isErpEnabled: boolean;
  editor: Pick<Editor, "modifiedIds" | "resultsState" | "methodsState" | "resetModified" | "updateFieldValue">;
}) {
  const navigate = useNavigate();
  const updateStatus = useUpdateOrderStatus();
  const saveResults = useSaveResults();
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const { modifiedIds, resultsState, methodsState, resetModified, updateFieldValue } = editor;

  async function handleSaveAll() {
    if (!order) return;
    if (modifiedIds.size === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }

    setIsSavingAll(true);
    try {
      await saveResults.mutateAsync({
        orderId: order.id,
        orgId: order.org_id,
        items: Array.from(modifiedIds).map((itemId) => ({
          itemId,
          resultsData: resultsState[itemId] as unknown as Json,
          testMethodId: (methodsState[itemId] as SelectedMethod)?.id ?? null,
          methodName: (methodsState[itemId] as SelectedMethod)?.name ?? null,
        })),
      });
      toast.success("Resultados guardados correctamente");
      resetModified();
    } catch (error) {
      // All-or-nothing: every exam stays marked as modified, which is accurate.
      toast.error(getSaveResultsErrorMessage(error));
    } finally {
      setIsSavingAll(false);
    }
  }

  function buildOrderSignature() {
    return {
      firma_url: profile?.firma_url || null,
      firma_name: profile?.full_name || null,
      sello_url: profile?.sello_url || null,
      signature_footer_text: profile?.signature_footer_text || null,
    };
  }

  function handleMarkReadyForApproval() {
    if (!order) return;
    updateStatus.mutate({ orderId: order.id, orgId: order.org_id, status: "por_aprobar" });
  }

  function handleApproveAndSign() {
    if (!order) return;
    if (!canApproveAndSignOrder(profile)) {
      toast.error("Primero debes cargar tu firma o sello en Configuracion de Perfil.");
      navigate("/settings");
      return;
    }

    // ERP labs confirm supply consumption; the RPC discounts stock and completes the order.
    if (isErpEnabled) {
      setConsumptionOpen(true);
      return;
    }

    updateStatus.mutate({
      orderId: order.id,
      orgId: order.org_id,
      status: "completada",
      completed_at: new Date().toISOString(),
      ...buildOrderSignature(),
    });
  }

  const statusAction = order ? getOrderStatusAction(role, order.status) : null;
  const primaryStatusAction =
    statusAction === "mark_ready"
      ? { label: "Marcar por aprobar", onClick: handleMarkReadyForApproval }
      : statusAction === "approve_and_sign"
        ? { label: "Aprobar y Firmar", onClick: handleApproveAndSign }
        : null;

  async function handleFileUploadForOCR(
    event: ChangeEvent<HTMLInputElement>,
    categoryItems: OrderItem[],
    categoryName: string
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setOcrLoading(categoryName);
    const toastId = toast.loading(`Analizando imagen de ${categoryName}`);

    try {
      const fieldsToExtract = collectOcrFieldLabels(categoryItems, resultsState as Record<string, OrderItemResultsState>);

      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const { data: extractedResults, error } = await supabase.functions.invoke("analyze-lab-report", {
        body: { image: base64Image, fields: fieldsToExtract },
      });

      if (error) {
        const errorDetails = await error.context?.json();
        console.log("Detalles del error OCR:", errorDetails);
      }

      const fieldsUpdated = applyOcrResultsToState(categoryItems, resultsState, extractedResults, updateFieldValue);

      if (fieldsUpdated > 0) {
        toast.success(`Se autocompletaron ${fieldsUpdated} valores. Por favor, revísalos.`, { id: toastId });
      } else {
        toast.warning("No se detectó valores coincidentes en esta imagen.", { id: toastId });
      }
    } catch (error) {
      console.error("Error con OCR:", error);
      toast.error("No se pudo procesar la imagen.", { id: toastId });
    } finally {
      setOcrLoading(null);
      event.target.value = "";
    }
  }

  return {
    isSavingAll,
    handleSaveAll,
    ocrLoading,
    handleFileUploadForOCR,
    primaryStatusAction,
    statusUpdating: updateStatus.isPending,
    consumption: { open: consumptionOpen, setOpen: setConsumptionOpen, signature: buildOrderSignature() },
  };
}

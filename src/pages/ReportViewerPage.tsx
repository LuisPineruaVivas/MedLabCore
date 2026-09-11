import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { getReportComponent } from "@/lib/orderReportDispatcher";
import { usePatientSession, usePatientOrders } from "@/features/patients/usePatientPortal";
import { usePublicOrgBrand } from "@/features/patientPortal/useOrgPatientPortal";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInYears } from "date-fns";

export default function ReportViewerPage() {
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");
  const dni = searchParams.get("dni") || "";
  const pin = searchParams.get("pin") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: brand } = usePublicOrgBrand(orgId);
  const { session, authenticate } = usePatientSession();
  const { data: orders = [], isLoading: ordersLoading } = usePatientOrders(session?.patient_id || null, pin);

  // 1. Autenticar automáticamente al cargar la vista
  useEffect(() => {
    async function initAuth() {
      if (!dni || !pin) {
        setError("Parámetros de acceso incompletos o inválidos.");
        setLoading(false);
        return;
      }
      if (!session) {
        const result = await authenticate(dni, pin);
        if (!result.success) {
          setError(result.error || "No se pudo autenticar para acceder al informe.");
        }
      }
      setLoading(false);
    }
    initAuth();
  }, [dni, pin]);

  const patientInfo = session ? {
    name: `${session.patient_info.first_name} ${session.patient_info.last_name}`.toUpperCase(),
    id: session.patient_info.id_number,
    age: session.patient_info.date_of_birth
      ? `${differenceInYears(new Date(), new Date(session.patient_info.date_of_birth))} Años`
      : "N/A",
    gender: session.patient_info.gender || "N/A",
  } : null;

  // Buscar la orden específica correspondiente al PIN
  const targetOrder = orders.find((o) => o.access_pin === pin) || orders[0];

  // Auto-abrir en navegador si es un dispositivo móvil
  const reportTemplate = targetOrder?.report_template || (brand as any)?.report_template;
  const ReportComponent = getReportComponent(reportTemplate);

  useEffect(() => {
    const isMobile = typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    
    if (isMobile && targetOrder && patientInfo) {
      pdf(
        <ReportComponent
          orden={targetOrder}
          orderItems={targetOrder.items}
          departmentOrder={targetOrder.departmentOrder}
          patientData={patientInfo}
          labData={{
            name: targetOrder.org_name || "Laboratorio",
            address: brand?.address || "",
            phone: brand?.phone || "",
            email: brand?.email || "",
            logo: targetOrder.org_logo_url || null,
            primary_color: brand?.primary_color || "#0ea5e9"
          }}
        />
      ).toBlob().then((reportBlob) => {
        const url = URL.createObjectURL(reportBlob);
        window.location.href = url; // Redirige directamente al blob en móvil
      });
    }
  }, [targetOrder, patientInfo, ReportComponent, brand]);

  if (loading || ordersLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-lg font-medium">Cargando informe de resultados...</p>
      </div>
    );
  }

  if (error || !targetOrder || !patientInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-lg text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">No se pudo cargar el informe</h2>
          <p className="text-sm text-muted-foreground">{error || "No se encontraron datos de la orden solicitada."}</p>
          <Button onClick={() => window.location.href = "/portal-paciente"}>
            Ir al Portal del Paciente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      <PDFViewer width="100%" height="100%" className="border-none">
        <ReportComponent
          orden={targetOrder}
          orderItems={targetOrder.items}
          departmentOrder={targetOrder.departmentOrder}
          patientData={patientInfo}
          labData={{
            name: targetOrder.org_name,
            address: brand?.address || "",
            phone: brand?.phone || "",
            email: brand?.email || "",
            logo: targetOrder.org_logo_url || null,
            primary_color: brand?.primary_color
          }}
        />
      </PDFViewer>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { UnifiedTestReportPDF } from "@/lib/unifiedTestReportPDF";
import { format, differenceInYears } from "date-fns";
import { Search, FlaskConical, FileText, ShieldCheck, AlertCircle, Loader2, LogOut, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientSession, usePatientOrders } from "@/features/patients/usePatientPortal";
import { usePublicOrgBrand } from "@/features/patientPortal/useOrgPatientPortal";

export default function PatientPortalPage() {
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");
  const [dni, setDni] = useState(searchParams.get("dni") || "");
  const [pin, setPin] = useState(searchParams.get("pin") || "");
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { data: brand, isLoading: isBrandLoading } = usePublicOrgBrand(orgId);
  const headerStyle = brand ? {
    background: `linear-gradient(90deg, ${brand.primary_color}, ${brand.secondary_color})`,
    borderRadius: "0 0 50px 50px",
  } : {};
    
  // Rate limiting states
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  
  const { session, authenticate, logout } = usePatientSession();
  const { data: orders = [], isLoading: ordersLoading } = usePatientOrders(session?.patient_id || null, pin);

  // Auto-login if URL has params
  useEffect(() => {
    const dniParam = searchParams.get("dni");
    const pinParam = searchParams.get("pin");
    if (dniParam && pinParam && !session) {
      setDni(dniParam);
      setPin(pinParam);
      handleAuth(dniParam, pinParam);
    }
  }, [session]);

  async function handleAuth(dniValue?: string, pinValue?: string) {
    const dniToUse = dniValue || dni;
    const pinToUse = pinValue || pin;
    
    if (!dniToUse.trim() || !pinToUse.trim()) return;

    // Check rate limit
    if (lockoutUntil && new Date() < lockoutUntil) {
      const minutesLeft = Math.ceil((lockoutUntil.getTime() - Date.now()) / 60000);
      setError(`Cuenta bloqueada por seguridad. Intenta nuevamente en ${minutesLeft} minutos.`);
      return;
    }

    // Clear lockout if time has passed
    if (lockoutUntil && new Date() >= lockoutUntil) {
      setLockoutUntil(null);
      setAttempts(0);
    }

    setLoading(true);
    setError(null);

    const result = await authenticate(dniToUse, pinToUse);
    
    if (!result.success) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutUntil(new Date(Date.now() + LOCKOUT_DURATION_MS));
        setAttempts(0);
        setError(`Demasiados intentos fallidos. Cuenta bloqueada por 5 minutos.`);
      } else {
        setError(`${result.error || "Error de autenticación"} (Intento ${newAttempts}/${MAX_ATTEMPTS})`);
      }
    } else {
      setAttempts(0); // reset on success
      setError(null);
    }
    
    setLoading(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await handleAuth();
  }

  function handleLogout() {
    logout();
    setDni("");
    setPin("");
    setError(null);
    setSelectedOrder(null);
    setPdfOpen(false);
  }

  async function handleViewReport(order) {
    const isMobile = typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (isMobile) {
      setReportLoading(true);
      try {
        const reportBlob = await pdf(
          <UnifiedTestReportPDF
            orden={order}
            orderItems={order.items}
            departmentOrder={order.departmentOrder}
            patientData={patientInfo || { name: "", id: "", age: "", gender: "" }}
            labData={{
              name: order.org_name || "Laboratorio",
              address: brand?.address || "",
              phone: brand?.phone || "",
              email: brand?.email || "",
              logo: order.org_logo_url || null,
              primary_color: brand?.primary_color || "#0ea5e9"
              
            }}
          />
        ).toBlob();

        const url = URL.createObjectURL(reportBlob);
        window.open(url, "_blank");
      } catch (err) {
        console.error("Error abriendo informe en móvil:", err);
        setError("No se pudo abrir el informe en el móvil. Intenta de nuevo o descarga el PDF.");
      } finally {
        setReportLoading(false);
      }
      return;
    }

    setSelectedOrder(order);
    setPdfOpen(true);
  }

  // Patient info for authenticated session
  const patientInfo = session ? {
    name: `${session.patient_info.first_name} ${session.patient_info.last_name}`.toUpperCase(),
    id: session.patient_info.id_number,
    age: session.patient_info.date_of_birth
      ? `${differenceInYears(new Date(), new Date(session.patient_info.date_of_birth))} Años`
      : "N/A",
    gender: session.patient_info.gender || "N/A",
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 shadow-lg transition-all duration-500">
        <div 
          className={`flex items-center justify-center px-4 h-28 text-white ${!brand ? 'bg-primary' : ''}`}
          style={headerStyle}
        >
          {isBrandLoading ? (
             <Loader2 className="h-8 w-8 animate-spin" />
          ) : brand ? (
            <div className="flex items-center gap-4">
              <div className="h-20 w-72 rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center shadow-inner">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-primary font-bold text-xl">{brand.name?.slice(0,2)}</span>
                )}
              </div>
            </div>
          ) : (
            <h1 className="text-xl font-bold">Portal de Pacientes</h1>
          )}
        </div>
      </header>
    

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Search Form */}
        {!session && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Consulta de Resultados</CardTitle>
              <CardDescription className="text-base">
                Ingresa tu número de cédula y el PIN de acceso.
                EJ: <span className="font-bold bg-slate-200 p-1 rounded">19458302</span> <br></br>  
                En caso de ser menor de edad el paciente, agrega un guion y un 1 al final <br></br> 
                de la cedula del representante EJ: <span className="font-bold bg-slate-200 p-1 rounded">11948302-1</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4 max-w-sm mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="dni">Cédula de Identidad</Label>
                  <Input
                    id="dni"
                    placeholder="Ej: 12345678"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN de Acceso</Label>
                  <Input
                    id="pin"
                    placeholder="Ej: A3F2B1"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="font-mono tracking-widest text-center text-lg"
                    required
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Consultar Resultados
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Patient History Dashboard */}
        {session && patientInfo && (
          <div className="space-y-6 animate-fade-in">
            {/* Patient Info Card */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{patientInfo.name}</CardTitle>
                    <CardDescription>
                      Cédula: {patientInfo.id} · Edad: {patientInfo.age} · Género: {patientInfo.gender}
                    </CardDescription>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Historial Clínico
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </CardHeader>
            </Card>

            {/* Orders History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Órdenes Médicas</h2>
                {ordersLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
              
              {ordersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-0 shadow-sm">
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <FlaskConical className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-muted-foreground mb-2">No hay órdenes completadas</h3>
                    <p className="text-sm text-muted-foreground">
                      Aún no tienes órdenes con resultados disponibles en el sistema.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    console.log("Order item:", order),
                    <Card key={order.order_seq} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div>
                              <h3 className="font-semibold text-lg">{order.org_name}</h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{format(new Date(order.created_at), "dd/MM/yyyy")}</span>
                                <span>·</span>
                                <span>PIN: {order.access_pin}</span>
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            Completada
                          </Badge>
                        </div>
                        
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>🧪 {order.items.length} exámen{order.items.length !== 1 ? 'es' : ''} realizado{order.items.length !== 1 ? 's' : ''}</span>
                            <span>·</span>
                            {/*<span>💰 ${order.total_amount.toFixed(2)}</span>*/}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="bg-muted/50 rounded-lg px-3 py-2">
                                <p className="text-sm font-medium truncate">{item.test_name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full"
                          onClick={() => handleViewReport(order)}
                          disabled={reportLoading}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {reportLoading ? "Generando..." : "Ver Informe de Resultados"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* PDF Dialog */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Informe de Resultados</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-md border bg-muted">
            {selectedOrder && patientInfo ? (
              <PDFViewer width="100%" height="100%" className="border-none">
                <UnifiedTestReportPDF
                  orden={selectedOrder}
                  orderItems={selectedOrder.items}
                  departmentOrder={selectedOrder.departmentOrder}
                  patientData={{
                    ...patientInfo
                  }}
                  labData={{
                    name: selectedOrder.org_name,
                    address: brand?.address || "",
                    phone: brand?.phone || "",
                    email: brand?.email || "",
                    logo: selectedOrder.org_logo_url || null,
                    primary_color: brand?.primary_color
                  }}
                />
              </PDFViewer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Cargando datos del reporte...</p>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setPdfOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t bg-white/50 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          <p>Portal seguro de consulta de resultados. Sus datos están protegidos.</p>
        </div>
      </footer>
    </div>
  );
}

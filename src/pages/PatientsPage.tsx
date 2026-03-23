import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Calendar,
  ChevronRight,
  Users,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInYears, format } from "date-fns";
import { NewPatientDialog } from "@/features/patients/NewPatientDialog";
import type { PatientFormData } from "@/features/patients/schemas";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/useDebounce";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 500);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const orgId = profile?.org_id;

  const { data: patientsData, isLoading, refetch } = useQuery({
    queryKey: ["patients", orgId, page, debouncedSearch],
    queryFn: async () => {
      if (!orgId) return { items: [], total: 0 };
      const offset = (page - 1) * pageSize;

      // 1. Modificamos el select para incluir un conteo de exámenes pendientes
      // Usamos un filtro de relación: exams(count) con un filtro interno
      let query = supabase
        .from("patients")
        .select(`
        *,
        pending_exams:orders(count)
      `, { count: "exact" })
        .eq("org_id", orgId!)
        // Agregamos el filtro para que solo cuente los que NO están listos
        .neq("orders.status", "completada")
        .order("created_at", { ascending: false });

      if (debouncedSearch.trim()) {
        const filter = `%${debouncedSearch.trim()}%`;
        query = query.or(`first_name.ilike.${filter},last_name.ilike.${filter},id_number.ilike.${filter}`);
      }

      const { data, error, count } = await query.range(offset, offset + pageSize - 1);
      if (error) throw error;

      return {
        items: data ?? [],
        total: count ?? 0,
      };
    },
    enabled: !!orgId,
  });

  const totalPatients = patientsData?.total ?? 0;
  const patientsToDisplay = patientsData?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(totalPatients / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search]);

  const createMutation = useMutation({
    mutationFn: async (formData: PatientFormData) => {
      const { error } = await supabase.from("patients").insert([{
        id_number: formData.id_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        org_id: orgId!,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        occupation: formData.occupation || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient-stats"] });
      toast.success("Patient created successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const avatarColors = [
    "bg-blue-100 text-blue-600",
    "bg-purple-100 text-purple-600",
    "bg-pink-100 text-pink-600",
    "bg-orange-100 text-orange-600",
    "bg-emerald-100 text-emerald-600",
  ];

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getColor = (index: number) => {
    return avatarColors[index % avatarColors.length];
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
      queryKey: ["patient-stats", orgId],
      queryFn: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Ejecutamos 3 conteos en paralelo para máxima velocidad
        const [total, month, day] = await Promise.all([
          // Total histórico
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .eq("org_id", orgId!),
          
          // Registrados este mes
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .eq("org_id", orgId!)
            .gte("created_at", firstDayOfMonth.toISOString()),

          // Registrados hoy
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .eq("org_id", orgId!)
            .gte("created_at", today.toISOString()),
        ]);

        return {
          total: total.count || 0,
          thisMonth: month.count || 0,
          today: day.count || 0,
        };
      },
      enabled: !!orgId,
    });

  return (
    <div className="space-y-6 sm:space-y-4 animate-fade-in pb-10">
      <PageHeader
        title="Directorio de Pacientes"
        description="Gestiona eficientemente los registros de pacientes"
        actions={
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Nuevo Paciente</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        }
      />

      {/* Statistics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatCard
          title="Total Pacientes Registrados"
          value={statsLoading ? "..." : stats?.total.toLocaleString()}
          icon={Users}
          className="bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
        <StatCard
          title="Registrados este Mes"
          value={statsLoading ? "..." : stats?.thisMonth.toLocaleString()}
          icon={Calendar}
          className="bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
        <StatCard
          title="Pacientes Registrados Hoy"
          value={statsLoading ? "..." : stats?.today.toLocaleString()}
          icon={Plus} // O CheckCircle2
          className="bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
      </div>

      <Card className="bg-card rounded-xl border border-border p-0 shadow-sm">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-4 px-6 py-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por Cédula, Nombre o Número de Teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 bg-muted/20 border-border"
            />
          </div>
          {/*<div className="flex flex-wrap items-center gap-3">
            <Select defaultValue="all">
              <SelectTrigger className="w-[160px] h-11 bg-muted/20 border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Date: All Time" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Date: All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="w-[160px] h-11 bg-muted/20 border-border">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Status: All" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="pathology">
              <SelectTrigger className="w-[180px] h-11 bg-muted/20 border-border">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Dept: Pathology" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pathology">Dept: Pathology</SelectItem>
                <SelectItem value="hematology">Dept: Hematology</SelectItem>
                <SelectItem value="radiology">Dept: Radiology</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-11 w-11 hover:bg-muted/50">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>*/}
        </CardHeader>
        
        <Table className="w-full text-left border-collapse hidden md:table">
          <TableHeader>
            <TableRow className="bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border" >
              <TableHead className="px-6 py-4 font-semibold">Cedula</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Nombre</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Contacto</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Registrado</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Examenes Pendiente</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody >
            {patientsToDisplay.map((patient, index) => (
              <TableRow
                key={patient.id}
                className="group hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/patients/${patient.id}`)}
              >
                <TableCell className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[14px] font-bold bg-muted text-muted-foreground font-mono">
                    {patient.id_number || patient.id.slice(0, 4)}
                  </span>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className={`h-9 w-9 border-none ${getColor(index)}`}>
                      <AvatarFallback className="font-bold text-xs bg-transparent">
                        {getInitials(patient.first_name, patient.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground leading-tight">
                        {patient.first_name} {patient.last_name}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 capitalize">  
                        {patient.gender}, {differenceInYears(new Date(), new Date(patient.date_of_birth))} anos
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground leading-tight">
                    {patient.phone || "+1 (555) 000-0000"}
                    </span>
                    <span className="text-sm text-muted-foreground leading-tight">  
                      {patient.email || "[EMAIL_ADDRESS]"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                  <span className="text-sm font-semibold text-foreground leading-tight">
                    {format(new Date(patient.created_at), "MMM d, yyyy")}
                  </span>
                </TableCell>
                <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                  {(() => {
                      // Extraemos el conteo del objeto que devuelve Supabase
                      const pendingCount = patient.pending_exams?.[0]?.count || 0;

                      return (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                            ${pendingCount > 0
                            ? "bg-orange-100 text-orange-700"
                            : "bg-emerald-100 text-emerald-700"}`}>
                          {pendingCount === 0 ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Al día</>
                          ) : (
                            `${pendingCount} Pendiente${pendingCount > 1 ? 's' : ''}`
                          )}
                        </span>
                      );
                    })()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
              
        </Table>

        {isLoading && (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground italic">Cargando pacientes...</p>
          </div>
        )}

        {!isLoading && patientsToDisplay.length === 0 && (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No se encontraron pacientes con estos datos</p>
          </div>
        )}

        {/* Mobile view - Simple cards */}
        <div className="md:hidden space-y-3 mb-4">
          {patientsToDisplay.map((patient, index) => (
            <div
              key={patient.id}
              className="bg-card rounded-xl border border-border p-4 shadow-sm active:bg-muted/30 transition-colors m-2 cursor-pointer"
              onClick={() => navigate(`/patients/${patient.id}`)}
            >
              <div className="flex items-center gap-3">
                <Avatar className={`h-10 w-10 ${getColor(index)}`}>
                  <AvatarFallback className="font-bold text-xs bg-transparent">
                    {getInitials(patient.first_name, patient.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-foreground">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <p className="text-[12px] text-muted-foreground font-mono">{patient.id_number || patient.id.slice(0, 4)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>

        <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-sm text-muted-foreground">
            Mostrando <span className="text-foreground">{Math.min(totalPatients, (page - 1) * pageSize + 1)} a {Math.min(totalPatients, page * pageSize)}</span> de <span className="text-foreground">{totalPatients.toLocaleString()}</span> pacientes
          </span>
          <div className="flex items-center gap-1.5 pb-4 sm:pb-0">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={(e) => { e.stopPropagation(); setPage(prev => Math.max(prev - 1, 1)); }}
              disabled={page <= 1}
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>

            {[...Array(Math.min(5, pageCount))].map((_, i) => {
              const p = i + 1;
              return (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  className={`h-8 w-8 rounded-md text-xs font-bold ${p === page ? "bg-primary text-primary-foreground" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setPage(p); }}
                >
                  {p}
                </Button>
              );
            })}

            {pageCount > 5 && <span className="text-muted-foreground px-1">...</span>}
            {pageCount > 5 && (
              <Button
                variant={page === pageCount ? "default" : "outline"}
                className="h-8 w-12 rounded-md text-xs font-bold"
                onClick={(e) => { e.stopPropagation(); setPage(pageCount); }}
              >
                {pageCount}
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={(e) => { e.stopPropagation(); setPage(prev => Math.min(prev + 1, pageCount)); }}
              disabled={page >= pageCount}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardFooter>

      </Card>

      <NewPatientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(data) => createMutation.mutateAsync(data)}
      />
    </div>
  );
}



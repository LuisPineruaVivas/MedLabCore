import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, ChevronRight, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { differenceInYears, format } from "date-fns";
import { NewPatientDialog } from "@/features/patients/NewPatientDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/useDebounce";
import { useCreatePatient, usePatientStats, usePatientsList } from "@/features/patients/usePatients";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 500);
  const { data: patientsData, isLoading } = usePatientsList(page, debouncedSearch);
  const { data: stats, isLoading: statsLoading } = usePatientStats();
  const createMutation = useCreatePatient();

  const totalPatients = patientsData?.total ?? 0;
  const patientsToDisplay = patientsData?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(totalPatients / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search]);

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

  return (
    <div className="space-y-6 sm:space-y-4 animate-fade-in pb-10">
      <PageHeader
        title="Directorio de Pacientes"
        description="Gestiona eficientemente los registros de pacientes"
        actions={
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1 sm:mr-2" />
            <span>Nuevo Paciente</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4">
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
          title="Registrados Hoy"
          value={statsLoading ? "..." : stats?.today.toLocaleString()}
          icon={Plus}
          className="hidden md:block bg-white border-border shadow-sm hover:shadow-md transition-shadow"
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
        </CardHeader>

        <Table className="w-full text-left border-collapse hidden md:table">
          <TableHeader>
            <TableRow className="bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
              <TableHead className="px-6 py-4 font-semibold">Cedula</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Nombre</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Contacto</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Registrado</TableHead>
              <TableHead className="px-6 py-4 font-semibold">Examenes Pendiente</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {patientsToDisplay.map((patient, index) => (
              <TableRow
                key={patient.id}
                className="group hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/patients/${patient.id}`)}
              >
                <TableCell className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[14px] font-bold bg-muted font-mono">
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
                    {patient.phone || "[Sin Teléfono]"}
                    </span>
                    <span className="text-sm text-muted-foreground leading-tight">  
                      {patient.email || "[Sin Email]"}
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
                    const pendingCount = patient.pending_exams?.[0]?.count || 0;

                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${pendingCount > 0 ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {pendingCount === 0 ? (
                          <><CheckCircle2 className="w-3 h-3 mr-1" /> Al día</>
                        ) : (
                          `${pendingCount} Pendiente${pendingCount > 1 ? "s" : ""}`
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
              onClick={(e) => { e.stopPropagation(); setPage((prev) => Math.max(prev - 1, 1)); }}
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
              onClick={(e) => { e.stopPropagation(); setPage((prev) => Math.min(prev + 1, pageCount)); }}
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
        onSubmit={async (data) => {
          try {
            await createMutation.mutateAsync(data);
            toast.success("Paciente creado correctamente");
          } catch (error) {
            if (error.message.includes("patients_id_number_org_unique") || error.message.includes("duplicate key value")) {
              toast.error("Ya existe un paciente con ese número de cédula en el laboratorio");
            } else {
              toast.error(error.message);
            }
            throw error;
          }
        }}
      />
    </div>
  );
}

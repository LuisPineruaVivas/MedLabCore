import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronRight, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { differenceInMonths, differenceInYears, format } from "date-fns";
import { es } from "date-fns/locale";
import { NewPatientDialog } from "@/features/patients/NewPatientDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const { data: stats } = usePatientStats();
  const createMutation = useCreatePatient();

  const totalPatients = patientsData?.total ?? 0;
  const patientsToDisplay = patientsData?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(totalPatients / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };
  const ageLabel = (dateOfBirth: string) => {
    const years = differenceInYears(new Date(), new Date(dateOfBirth));
    return years > 0 ? `${years} años` : `${differenceInMonths(new Date(), new Date(dateOfBirth))} meses`;
  };
  const openPatient = (id: string) => navigate(`/patients/${id}`);

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      <PageHeader
        title="Pacientes"
        description={stats ? `${stats.total.toLocaleString("es-VE")} registrados · ${stats.thisMonth.toLocaleString("es-VE")} este mes · ${stats.today.toLocaleString("es-VE")} hoy` : "Busca un paciente por cédula, nombre o teléfono."}
        actions={
          <Button onClick={() => setDialogOpen(true)} data-tour="new-patient">
            <Plus />
            Nuevo paciente
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-4 px-4 py-4 sm:px-6 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Buscar pacientes"
              placeholder="Buscar por cédula, nombre o teléfono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
        </CardHeader>

        <Table className="w-full text-left border-collapse hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead className="px-6">Paciente</TableHead>
              <TableHead className="px-6">Cédula</TableHead>
              <TableHead className="px-6">Contacto</TableHead>
              <TableHead className="px-6">Registrado</TableHead>
              <TableHead className="px-6">Exámenes pendientes</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {patientsToDisplay.map((patient) => (
              <TableRow
                key={patient.id}
                className="cursor-pointer"
                tabIndex={0}
                aria-label={`Abrir ficha de ${patient.first_name} ${patient.last_name}`}
                onClick={() => openPatient(patient.id)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPatient(patient.id); } }}
              >
                <TableCell className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="neu-inset text-xs font-bold text-primary">
                        {getInitials(patient.first_name, patient.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold leading-tight">{patient.first_name} {patient.last_name}</span>
                      <span className="mt-0.5 text-xs text-muted-foreground">
                        <span className="capitalize">{patient.gender}</span> · {ageLabel(patient.date_of_birth)}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-3 text-sm font-medium tabular-nums">{patient.id_number || "—"}</TableCell>
                <TableCell className="px-6 py-3">
                  <div className="flex flex-col text-sm leading-tight">
                    <span className={patient.phone ? "font-medium tabular-nums" : "text-muted-foreground"}>{patient.phone || "Sin teléfono"}</span>
                    <span className="text-muted-foreground">{patient.email || "Sin correo"}</span>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-3 text-sm tabular-nums">
                  {format(new Date(patient.created_at), "d MMM yyyy", { locale: es })}
                </TableCell>
                <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                  {(() => {
                    const pendingCount = patient.pending_exams?.[0]?.count || 0;

                    return (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pendingCount > 0 ? "border-warning/40 text-warning" : "border-success/40 text-success"}`}>
                        {pendingCount === 0 ? (
                          <><CheckCircle2 className="w-3 h-3 mr-1" aria-hidden /> Al día</>
                        ) : (
                          `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}`
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
            <p className="text-sm text-muted-foreground">Cargando pacientes…</p>
          </div>
        )}

        {!isLoading && patientsToDisplay.length === 0 && (
          <div className="py-20 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden />
            <p className="text-sm font-medium">No hay pacientes con esa búsqueda.</p>
            <p className="mt-1 text-sm text-muted-foreground">Revisa la cédula o el nombre, o registra un paciente nuevo.</p>
          </div>
        )}

        <ul className="md:hidden space-y-3 p-3">
          {patientsToDisplay.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => openPatient(patient.id)}
                className="neu-rise flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-[var(--neu-raised-sm)] active:shadow-[var(--neu-inset)]"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="neu-inset text-xs font-bold text-primary">
                    {getInitials(patient.first_name, patient.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{patient.first_name} {patient.last_name}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">{patient.id_number || "Sin cédula"} · {ageLabel(patient.date_of_birth)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
          <span className="text-sm text-muted-foreground tabular-nums">
            <span className="text-foreground">{Math.min(totalPatients, (page - 1) * pageSize + 1)}–{Math.min(totalPatients, page * pageSize)}</span> de <span className="text-foreground">{totalPatients.toLocaleString("es-VE")}</span> pacientes
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              className="h-9 w-9"
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
                  aria-label={`Página ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  className="h-9 w-9 tabular-nums"
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
                aria-label={`Página ${pageCount}`}
                className="h-9 min-w-9 px-2 tabular-nums"
                onClick={(e) => { e.stopPropagation(); setPage(pageCount); }}
              >
                {pageCount}
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente"
              className="h-9 w-9"
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
            toast.success("Paciente registrado.");
          } catch (error) {
            const message = (error as { message?: string } | null)?.message ?? String(error);
            if (message.includes("patients_id_number_org_unique") || message.includes("duplicate key value")) {
              toast.error("Ya existe un paciente con ese número de cédula en el laboratorio");
            } else {
              toast.error(message);
            }
            throw error;
          }
        }}
      />
    </div>
  );
}

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EditPatientDialog } from "@/features/patients/EditPatientDialog";
import type { PatientFormData } from "@/features/patients/schemas";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  Edit,
} from "lucide-react";
import { differenceInYears, format } from "date-fns";
import React from "react";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const updatePatient = useMutation({
    mutationFn: async (data: PatientFormData) => {
      const { error } = await supabase
        .from("patients")
        .update({
          id_number: data.id_number,
          first_name: data.first_name,
          last_name: data.last_name,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          occupation: data.occupation || null,
        })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
      toast.success("Paciente actualizado correctamente");
    },
    onError: () => {
      toast.error("Error al actualizar el paciente");
    },
  });

  // Fetch patient
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch orders for this patient
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["patient-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("patient_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });


  if (patientLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Paciente no encontrado</p>
      </div>
    );
  }

  const age = differenceInYears(new Date(), new Date(patient.date_of_birth));

  const infoItems = [
    { icon: Calendar, label: "Fecha de Nacimiento", value: format(new Date(patient.date_of_birth), "dd/MM/yyyy") },
    { icon: User, label: "Edad", value: `${age} años` },
    { icon: User, label: "Género", value: patient.gender === "masculino" ? "Masculino" : "Femenino" },
    { icon: Phone, label: "Teléfono", value: patient.phone || "—" },
    { icon: Mail, label: "Correo", value: patient.email || "—" },
    { icon: MapPin, label: "Dirección", value: patient.address || "—" },
    { icon: Briefcase, label: "Ocupación", value: patient.occupation || "—" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${patient.first_name} ${patient.last_name}`}
        description={`Cédula: ${patient.id_number}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button variant="outline" onClick={() => navigate("/patients")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>
        }
      />

      {/* Patient Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información del Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orders History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Historial de Órdenes</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {orders.length} {orders.length === 1 ? "orden" : "órdenes"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {ordersLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Cargando órdenes...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Este paciente no tiene órdenes registradas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                    <React.Fragment key={order.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-success" />
                              <span className="text-sm font-semibold mono">{Number(order.total_amount).toFixed(2)}</span>
                            </div>
                            {order.total_bs != null && (
                              <span className="text-xs text-muted-foreground mono">Bs. {Number(order.total_bs).toFixed(2)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                            {order.notes || "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Patient Dialog */}
      <EditPatientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient ? {
          id_number: patient.id_number,
          first_name: patient.first_name,
          last_name: patient.last_name,
          date_of_birth: patient.date_of_birth,
          gender: patient.gender as "masculino" | "femenino",
          phone: patient.phone || "",
          email: patient.email || "",
          address: patient.address || "",
          occupation: patient.occupation || "",
        } : null}
        onSubmit={async (data) => { await updatePatient.mutateAsync(data); }}
      />
    </div>
  );
}

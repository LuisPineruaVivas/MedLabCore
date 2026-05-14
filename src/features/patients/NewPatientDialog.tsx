import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { patientSchema, type PatientFormData } from "./schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker-custom.css";

interface NewPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PatientFormData) => Promise<void>;
}

export function NewPatientDialog({ open, onOpenChange, onSubmit }: NewPatientDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      id_number: "",
      first_name: "",
      last_name: "",
      date_of_birth: null,
      gender: "masculino",
      phone: "",
      email: "",
      address: "",
    },
  });

  const dobValue = form.watch("date_of_birth");
  const age = dobValue
    ? differenceInYears(new Date(), new Date(dobValue))
    : null;

  async function handleSubmit(data: PatientFormData) {
    setLoading(true);
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
              "sm:max-w-5xl h-[90vh] overflow-y-auto sm:w-[70vw]",
              "sm:h-auto"
            )}>
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo Paciente</DialogTitle>
          <DialogDescription>Completa la información del paciente a continuación.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {/* ID Number */}
            <FormField
              control={form.control}
              name="id_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cedula</FormLabel>
                  <FormControl>
                    <Input placeholder="24562781" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* DOB + Age + Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Nacimiento *</FormLabel>
                    <FormControl>
                      <DatePicker
                        selected={field.value}
                        onChange={(date) => field.onChange(date)}
                        dateFormat="dd/MM/yyyy"
                        locale={es}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        minDate={new Date("1900-01-01")}
                        maxDate={new Date()}
                        placeholderText="Seleccionar fecha"
                        className={cn(
                          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                          !field.value && "text-muted-foreground"
                        )}
                        wrapperClassName="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Age (read-only) */}
              <div className="flex flex-col gap-2">
                <Label>Edad</Label>
                <Input
                  readOnly
                  value={age !== null ? `${age} años` : "—"}
                  className="bg-muted"
                />
              </div>

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Genero *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="femenino">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl>
                      <Input placeholder="424 567 890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="paciente@gmail.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direccion</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando…" : "Guardar Paciente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { z } from "zod";

export const patientSchema = z.object({
  id_number: z.string().trim().min(1, "Cedula es requerida").max(20),
  first_name: z.string().trim().min(1, "Nombre es requerido").max(100),
  last_name: z.string().trim().min(1, "Apellido es requerido").max(100),
  date_of_birth: z.date().max(new Date(), "La fecha de nacimiento no puede ser mayor a la fecha actual"),
  gender: z.enum(["masculino", "femenino"]),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("Correo Invalido").max(255).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  occupation: z.string().trim().max(200).optional().or(z.literal("")),
});

export type PatientFormData = z.infer<typeof patientSchema>;
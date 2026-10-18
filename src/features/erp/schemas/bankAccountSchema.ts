import { z } from "zod";

export const bankAccountSchema = z.object({
  name: z.string().trim().min(2, "Indica un nombre para el método"),
  method_type: z.enum(["cash", "bank_transfer", "mobile_payment", "zelle", "pos_terminal", "other"]),
  currency: z.string().trim().length(3, "Usa un código ISO de tres letras").transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  account_number: z.string().trim().max(80).optional().or(z.literal("")),
  phone_number: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { bankAccountSchema, type BankAccountFormValues } from "../schemas/bankAccountSchema";
import type { BankAccount } from "../types";

const defaults: BankAccountFormValues = { name: "", method_type: "cash", currency: "USD", description: "", bank_name: "", account_number: "", phone_number: "", email: "", is_active: true };
export function BankAccountForm({ account, onSubmit, pending }: { account?: BankAccount | null; onSubmit: (values: BankAccountFormValues) => void; pending: boolean }) {
  const form = useForm<BankAccountFormValues>({ resolver: zodResolver(bankAccountSchema), defaultValues: defaults });
  useEffect(() => { form.reset(account ? { ...defaults, ...account, description: account.description ?? "", bank_name: account.bank_name ?? "", account_number: account.account_number ?? "", phone_number: account.phone_number ?? "", email: account.email ?? "" } : defaults); }, [account, form]);
  const error = (name: keyof BankAccountFormValues) => form.formState.errors[name]?.message;
  return <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Nombre</Label><Input {...form.register("name")} /><p className="text-xs text-destructive">{error("name")}</p></div><div><Label>Método</Label><Select value={form.watch("method_type")} onValueChange={(value) => form.setValue("method_type", value as BankAccountFormValues["method_type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="bank_transfer">Transferencia</SelectItem><SelectItem value="mobile_payment">Pago móvil</SelectItem><SelectItem value="zelle">Zelle</SelectItem><SelectItem value="pos_terminal">Punto de venta</SelectItem><SelectItem value="other">Otro</SelectItem></SelectContent></Select></div><div><Label>Moneda</Label><Input maxLength={3} {...form.register("currency")} /></div><div><Label>Banco</Label><Input {...form.register("bank_name")} /></div><div><Label>Referencia / cuenta</Label><Input {...form.register("account_number")} /></div><div><Label>Teléfono</Label><Input {...form.register("phone_number")} /></div></div><div className="flex items-center gap-2"><Switch checked={form.watch("is_active")} onCheckedChange={(value) => form.setValue("is_active", value)} /><Label>Disponible para cobrar</Label></div><Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar método"}</Button></form>;
}

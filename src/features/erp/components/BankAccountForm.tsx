import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { bankAccountSchema, type BankAccountFormValues } from "../schemas/bankAccountSchema";
import { PAYMENT_METHOD_LABELS } from "../utils/cashRegister";
import type { BankAccount } from "../types";

const defaults: BankAccountFormValues = { name: "", method_type: "cash", currency: "USD", description: "", bank_name: "", account_number: "", phone_number: "", email: "", is_active: true };

/** The lab's working currencies, stored as ISO codes. */
const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "USD", label: "Dólares (USD)" },
  { value: "VES", label: "Bolívares (Bs)" },
];

function bankAccountFormValues(account?: BankAccount | null): BankAccountFormValues {
  if (!account) return defaults;
  return {
    ...defaults,
    name: account.name,
    method_type: account.method_type,
    currency: account.currency,
    description: account.description ?? "",
    bank_name: account.bank_name ?? "",
    account_number: account.account_number ?? "",
    phone_number: account.phone_number ?? "",
    email: account.email ?? "",
    is_active: account.is_active,
  };
}

// Mount with key={account?.id ?? "new"}: values are read once at mount, so the
// selects always show the saved method and currency when editing.
export function BankAccountForm({ account, onSubmit, pending }: { account?: BankAccount | null; onSubmit: (values: BankAccountFormValues) => void; pending: boolean }) {
  const form = useForm<BankAccountFormValues>({ resolver: zodResolver(bankAccountSchema), defaultValues: bankAccountFormValues(account) });
  const error = (name: keyof BankAccountFormValues) => form.formState.errors[name]?.message;
  const currency = form.watch("currency");
  const currencyOptions = CURRENCY_OPTIONS.some((option) => option.value === currency) ? CURRENCY_OPTIONS : [...CURRENCY_OPTIONS, { value: currency, label: currency }];

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Nombre</Label>
          <Input {...form.register("name")} />
          <p className="text-xs text-destructive">{error("name")}</p>
        </div>
        <div>
          <Label>Método</Label>
          <Select value={form.watch("method_type")} onValueChange={(value) => form.setValue("method_type", value as BankAccountFormValues["method_type"], { shouldValidate: true })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-destructive">{error("method_type")}</p>
        </div>
        <div>
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={(value) => form.setValue("currency", value, { shouldValidate: true })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {currencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-destructive">{error("currency")}</p>
        </div>
        <div>
          <Label>Banco</Label>
          <Input {...form.register("bank_name")} />
          <p className="text-xs text-destructive">{error("bank_name")}</p>
        </div>
        <div>
          <Label>Referencia / cuenta</Label>
          <Input {...form.register("account_number")} />
          <p className="text-xs text-destructive">{error("account_number")}</p>
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input {...form.register("phone_number")} />
          <p className="text-xs text-destructive">{error("phone_number")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.watch("is_active")} onCheckedChange={(value) => form.setValue("is_active", value)} />
        <Label>Disponible para cobrar</Label>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar método"}</Button>
    </form>
  );
}

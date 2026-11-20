import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InstallmentInput } from "../hooks/usePaymentSchedules";
import { formatCurrency } from "../utils/currencyFormatters";
import {
  INSTALLMENT_FREQUENCY_LABELS,
  installmentDueDate,
  splitInstallments,
  todayIso,
  type InstallmentFrequency,
} from "../utils/finance";

export function PaymentScheduleForm({ balance, onSubmit, pending }: { balance: number; onSubmit: (items: InstallmentInput[]) => void; pending: boolean }) {
  // Kept as text so the field can be emptied while typing; an empty or 0 value can't be submitted.
  const [countText, setCountText] = useState("2");
  const typedCount = Number(countText);
  const countValid = Number.isInteger(typedCount) && typedCount >= 1 && typedCount <= 24;
  const count = countValid ? typedCount : 1;
  const [firstDate, setFirstDate] = useState(todayIso());
  const [frequency, setFrequency] = useState<InstallmentFrequency>("monthly");
  // Custom mode: dates the user typed, by row; rows left alone start from the monthly date.
  const [customDates, setCustomDates] = useState<Record<number, string>>({});

  const installments = useMemo(() => {
    const amounts = splitInstallments(balance, count);
    return amounts.map((amount_due_usd, index) => ({
      amount_due_usd,
      due_date:
        frequency === "custom"
          ? customDates[index] ?? (firstDate ? installmentDueDate(firstDate, index, "monthly") : "")
          : firstDate ? installmentDueDate(firstDate, index, frequency) : "",
    }));
  }, [balance, count, firstDate, frequency, customDates]);

  const invalidDates = installments.some((item, index) => !item.due_date || (index > 0 && item.due_date < installments[index - 1].due_date));

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (countValid && !invalidDates) onSubmit(installments); }}>
      <p className="text-sm">Saldo a programar: <b>{formatCurrency(balance)}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cuotas</Label>
          <Input type="number" min="1" max="24" value={countText} onChange={(event) => setCountText(event.target.value)} />
          {!countValid && <p className="mt-1 text-xs text-destructive">Entre 1 y 24 cuotas.</p>}
        </div>
        <div>
          <Label>Frecuencia</Label>
          <Select value={frequency} onValueChange={(value) => setFrequency(value as InstallmentFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(INSTALLMENT_FREQUENCY_LABELS) as InstallmentFrequency[]).map((key) => (
                <SelectItem key={key} value={key}>{INSTALLMENT_FREQUENCY_LABELS[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {frequency !== "custom" && (
          <div className="col-span-2">
            <Label>Primer vencimiento</Label>
            <Input type="date" value={firstDate} onChange={(event) => setFirstDate(event.target.value)} />
          </div>
        )}
      </div>
      {frequency === "custom" && <p className="text-xs text-muted-foreground">Elige la fecha de cada cuota.</p>}
      <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
        {installments.map((item, index) => (
          <div className="flex items-center justify-between gap-2 p-2 text-sm" key={index}>
            <span>Cuota {index + 1}</span>
            {frequency === "custom" ? (
              <span className="flex items-center gap-2">
                {formatCurrency(item.amount_due_usd)}
                <Input
                  type="date"
                  className="h-8 w-auto"
                  aria-label={`Vencimiento de la cuota ${index + 1}`}
                  value={item.due_date}
                  onChange={(event) => setCustomDates((dates) => ({ ...dates, [index]: event.target.value }))}
                />
              </span>
            ) : (
              <span>{formatCurrency(item.amount_due_usd)} · {item.due_date}</span>
            )}
          </div>
        ))}
      </div>
      {invalidDates && <p className="text-xs text-destructive">Cada cuota necesita una fecha, igual o posterior a la anterior.</p>}
      <Button type="submit" disabled={pending || !countValid || invalidDates}>{pending ? "Guardando..." : "Crear plan"}</Button>
    </form>
  );
}

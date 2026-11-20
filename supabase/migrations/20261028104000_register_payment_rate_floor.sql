-- Security audit run-2: rpc/register_payment/client-exchange-rate-trusted (medium).
--
-- register_payment converted a local-currency payment with the exchange_rate sent by
-- the caller and only checked it was > 0. A secretary could record 1 VES at a rate of
-- 0.01 and the database credited 100 USD, closing the invoice and the order as paid.
--
-- The app sends a live rate on purpose (the stored history can be days old), so the
-- server cannot simply force the stored rate. The bolívar only loses value, so a real
-- rate does not drop much below recent ones, while a rate that is too high only hurts
-- the payer. So, for callers other than a lab_admin (or super admin), the rate may not be
-- more than 10% below the lab's highest rate of the last 30 days (stored history,
-- invoices and payments in that currency). A forged low rate cannot pull that reference
-- down. The payment keeps exchange_rate_id only when the stored rate was the one used.
-- Remaining gap (documented): with no rate recorded in the last 30 days there is no
-- reference; a server-fetched daily rate would close it.

create or replace function public.erp_reference_rate(p_org_id uuid, p_currency text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select max(rate) from (
    select h.rate from public.exchange_rate_history h
    where h.org_id = p_org_id and h.from_currency = 'USD' and h.to_currency = upper(p_currency)
      and h.effective_date >= current_date - 30
    union all
    select i.exchange_rate from public.invoices i
    where i.org_id = p_org_id and upper(p_currency) = 'VES' and i.exchange_rate > 0
      and i.issued_at >= now() - interval '30 days'
    union all
    select p.exchange_rate from public.payments p
    where p.org_id = p_org_id and upper(p.currency) = upper(p_currency) and not p.is_void and p.exchange_rate > 0
      and p.created_at >= now() - interval '30 days'
  ) rates
$$;

revoke execute on function public.erp_reference_rate(uuid, text) from public, anon, authenticated;

create or replace function public.register_payment(p_org_id uuid, p_invoice_id uuid, p_payments jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment jsonb; v_invoice public.invoices%rowtype; v_account public.bank_accounts%rowtype;
  v_rate numeric; v_amount numeric; v_amount_usd numeric; v_total numeric := 0; v_rate_id uuid;
  v_org_rate numeric; v_reference numeric; v_can_override boolean;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'secretary']::public.user_role[]);
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then raise exception 'PAYMENTS_REQUIRED'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and org_id = p_org_id for update;
  if not found or v_invoice.status in ('cancelled', 'credit_note', 'paid') then raise exception 'INVOICE_NOT_PAYABLE'; end if;
  v_can_override := public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id and role = 'lab_admin');

  -- First pass validates everything so a bad line never leaves a partial payment behind.
  for v_payment in select value from jsonb_array_elements(p_payments) loop
    v_amount := (v_payment->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
    select * into v_account from public.bank_accounts where id = nullif(v_payment->>'bank_account_id', '')::uuid and org_id = p_org_id and is_active;
    if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
    if upper(coalesce(v_payment->>'currency', v_account.currency)) <> v_account.currency then raise exception 'ACCOUNT_CURRENCY_MISMATCH'; end if;
    if upper(v_account.currency) = 'USD' then
      v_amount_usd := v_amount;
    else
      v_rate := coalesce(nullif(v_payment->>'exchange_rate', '')::numeric, public.get_exchange_rate(p_org_id, 'USD', v_account.currency));
      if v_rate is null or v_rate <= 0 then raise exception 'EXCHANGE_RATE_REQUIRED'; end if;
      if not v_can_override then
        v_reference := public.erp_reference_rate(p_org_id, v_account.currency);
        if v_reference is not null and v_rate < v_reference * 0.9 then
          raise exception 'EXCHANGE_RATE_OUT_OF_RANGE';
        end if;
      end if;
      v_amount_usd := round(v_amount / v_rate, 2);
    end if;
    v_total := v_total + v_amount_usd;
  end loop;
  if v_total > v_invoice.balance_due_usd then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;

  for v_payment in select value from jsonb_array_elements(p_payments) loop
    select * into v_account from public.bank_accounts where id = (v_payment->>'bank_account_id')::uuid;
    v_amount := (v_payment->>'amount')::numeric;
    if upper(v_account.currency) = 'USD' then
      v_rate := 1; v_amount_usd := v_amount; v_rate_id := null;
    else
      v_rate := coalesce(nullif(v_payment->>'exchange_rate', '')::numeric, public.get_exchange_rate(p_org_id, 'USD', v_account.currency));
      v_amount_usd := round(v_amount / v_rate, 2);
      select id, rate into v_rate_id, v_org_rate from public.exchange_rate_history
      where org_id = p_org_id and from_currency = 'USD' and to_currency = v_account.currency and effective_date <= current_date
      order by effective_date desc, created_at desc limit 1;
      -- Link the stored rate only when it is the rate actually applied.
      if v_org_rate is distinct from v_rate then v_rate_id := null; end if;
    end if;
    insert into public.payments (org_id, invoice_id, amount, currency, amount_usd, exchange_rate_id, exchange_rate, bank_account_id, payment_method, method_type, reference_number, created_by)
    values (p_org_id, p_invoice_id, v_amount, v_account.currency, v_amount_usd, v_rate_id, v_rate, v_account.id, v_account.name, v_account.method_type,
            nullif(trim(coalesce(v_payment->>'reference_number', '')), ''), auth.uid());
  end loop;
  return jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'total_paid_usd', v_total);
end;
$$;

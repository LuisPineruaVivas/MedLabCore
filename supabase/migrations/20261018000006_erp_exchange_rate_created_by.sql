-- ERP: exchange_rate_history.created_by was taken from the client and not checked,
-- so an admin could attribute a rate to another user. Stamp it server-side.
-- (React Doctor supabase-client-owned-authz-field audit; split from 20261018000005.)

alter table public.exchange_rate_history alter column created_by set default auth.uid();

create or replace function public.trg_fn_set_exchange_rate_created_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_exchange_rate_created_by on public.exchange_rate_history;
create trigger trg_set_exchange_rate_created_by before insert on public.exchange_rate_history
  for each row execute function public.trg_fn_set_exchange_rate_created_by();

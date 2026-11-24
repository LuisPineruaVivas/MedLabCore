-- Test for migration 20261123000000_whatsapp_results_message. Rolled back.
--   npm run test:db -- whatsapp_results_message
-- A lab can store its own WhatsApp results message (up to 500 characters); other labs keep null.
-- Prints "WhatsApp results message passed".

begin;

create function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    if sqlerrm !~ p_pattern then
      raise exception 'Expected error matching "%" but got "%" for: %', p_pattern, sqlerrm, p_sql;
    end if;
  end;
  if not v_failed then
    raise exception 'Expected error matching "%" but statement succeeded: %', p_pattern, p_sql;
  end if;
end;
$$;

insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-00000000a001', 'WA Lab A'),
  ('00000000-0000-0000-0000-00000000a002', 'WA Lab B');

update public.organizations set whatsapp_results_message = 'Hola, te escribimos del Laboratorio A. Tus resultados están listos:'
where id = '00000000-0000-0000-0000-00000000a001';

do $$
begin
  if (select whatsapp_results_message from public.organizations where id = '00000000-0000-0000-0000-00000000a001') not like 'Hola, te escribimos%' then
    raise exception 'message not saved';
  end if;
  if (select whatsapp_results_message from public.organizations where id = '00000000-0000-0000-0000-00000000a002') is not null then
    raise exception 'other lab affected';
  end if;
end $$;

select pg_temp.expect_error(
  $q$update public.organizations set whatsapp_results_message = repeat('x', 501) where id = '00000000-0000-0000-0000-00000000a001'$q$,
  'organizations_whatsapp_results_message_length');

do $$ begin raise notice 'WhatsApp results message passed'; end $$;

rollback;

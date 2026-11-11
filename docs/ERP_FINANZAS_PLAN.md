# Plan: Finanzas simplificadas del ERP (cuentas, movimientos, por cobrar, por pagar)

> Noviembre 2026. Reemplaza la parte financiera "contable" del ERP por un modelo de **cuentas con saldo**.
> Inventario, Kardex y recetas (BOM) se **mantienen**; solo se conectan las compras con las cuentas.

## Estado

- [x] **Fase 1** (8 nov 2026, local): migración `20261108000000_erp_accounts_and_movements.sql` + test `erp_accounts_movements.sql`; páginas `/erp/accounts` y `/erp/movements`; caja retirada de la app (tablas intactas). Las cuentas existentes quedan con saldo inicial 0 y fecha de saldo inicial = día de la migración (los cobros anteriores no suman): el administrador debe cargar el saldo real de cada una.
- [x] **Fase 2** (8 nov 2026, local): migración `20261108010000_erp_payables_and_purchases.sql` + test `erp_payables_purchases.sql`; página `/erp/payables` (admin y secretaria); la compra de inventario se paga desde una cuenta (admin) o queda por pagar (sin cuenta, y siempre para el bioanalista). La carga inicial de stock no mueve dinero. Un pago anulado reabre la cuenta por pagar.
- [x] **Fase 3** (8 nov 2026, local): migración `20261108020000_erp_receivables_overview.sql` (RPC `get_receivables_overview`) + test `erp_receivables_overview.sql`; página `/erp/receivables` (admin y secretaria; reemplaza `/erp/accounts-receivable`) con totales, cuotas de todas las órdenes (todas, vencidas, 7 días, este mes) y saldos pendientes, con botón **Cobrar** que precarga lo que falta de la cuota. La antigüedad de saldos sigue en Reportes. Crear el plan de cuotas sigue en la factura (sólo admin).
- [x] **Fase 4** (8 nov 2026, local): migración `20261108030000_erp_finance_dashboard.sql` (RPC `get_finance_dashboard`, sólo admin) + test `erp_finance_dashboard.sql`; panel "Finanzas del laboratorio" en el Panel de control (admin): ingresos (órdenes + otros), egresos, ganancia en base caja, disponible en cuentas, ingresos vs. egresos de 6 meses, saldos por cuenta, gastos por categoría, por cobrar y por pagar, y últimos movimientos, con filtro de período. Las transferencias y ajustes no cuentan como ingreso ni egreso. La pestaña "Finanzas" de Reportes (facturado vs. cobrado, PDF) se mantiene.
- [x] **Fase 5** (8 nov 2026): `ERP.md`, `docs/ERP_GUIA_USUARIO.md` y `CLAUDE.md` actualizados; menú agrupado en *Administración* (escritorio) y barra + cajón *Menú* (móvil), con página de resumen `/erp`. Pendiente sólo el despliegue.

## Decisiones tomadas

- Los "métodos de cobro" (`bank_accounts`) pasan a ser **Cuentas**: nombre, moneda, saldo inicial. El tipo (efectivo, banco…) queda como dato opcional.
- **Saldo = saldo inicial + cobros de órdenes + otros ingresos − gastos ± transferencias ± ajustes.** Se calcula desde los movimientos, nunca se edita a mano.
- **Se elimina apertura/cierre de caja** (pantalla, ruta, PDF, hooks). Las tablas quedan (migraciones aditivas, historial intacto).
- **Cuentas por pagar** sí: gastos pendientes con vencimiento, con pagos parciales.
- **Inventario, Kardex y recetas se quedan igual**, incluido el modal de consumo al firmar (insumos de la receta + extras/repeticiones con motivo). Novedad: **una compra de inventario saca dinero de una cuenta** o queda como **por pagar**.
- Permisos:

| Acción | lab_admin | secretary | bioanalyst |
|---|---|---|---|
| Crear/editar cuentas, saldo inicial | ✅ | – | – |
| Cobrar órdenes y cuotas (elige cuenta) | ✅ | ✅ | – |
| Registrar gasto / otro ingreso | ✅ | ✅ | – |
| Transferencias y ajustes de saldo | ✅ | – | – |
| Anular movimientos | ✅ | – | – |
| Ver saldos, ganancia, dashboard financiero | ✅ | – (*) | – |
| Por cobrar (cuotas y saldos) | ✅ | ✅ | – |
| Por pagar: registrar | ✅ | ✅ | – |
| Por pagar: pagar (sale de una cuenta) | ✅ | ✅ | – |
| Compras de inventario | ✅ (elige cuenta o "por pagar") | – | ✅ (siempre queda "por pagar") |

(*) Supuesto a confirmar: la secretaria no ve saldos de cuentas, solo elige la cuenta al cobrar o pagar.

## Modelo de datos (una migración nueva, aditiva)

### `bank_accounts` (se amplía)
- `opening_balance numeric(14,2) not null default 0`, `opening_date date not null default current_date`.
- `method_type` se mantiene (lo usan pagos y reportes), pero en la UI es opcional.

### `finance_categories` (nueva)
- `id, org_id (null = global por defecto), name, kind ('expense' | 'income'), is_active, sort_order`.
- Globales sembradas en la migración: Servicios (luz, agua, internet), Alquiler, Nómina / pago al personal, Materiales de oficina, Insumos y reactivos, Mantenimiento de equipos, Impuestos, Honorarios, Otros gastos; Otros ingresos.
- Cada laboratorio puede crear las suyas (mismo patrón que las plantillas globales de exámenes).

### `account_movements` (nueva, libro inmutable; se anula, no se borra)
- `id, org_id, account_id, kind` enum: `income`, `expense`, `transfer_out`, `transfer_in`, `adjustment_in`, `adjustment_out`.
- `amount > 0` en la moneda de la cuenta, `currency`, `amount_usd`, `exchange_rate` (tasa usada para el equivalente en USD; en transferencias entre monedas, la tasa calculada llegó ÷ salió).
- `category_id`, `description`, `movement_date date`, `attachment_url` (comprobante, opcional).
- `transfer_id uuid` (une las dos patas de una transferencia), `payable_id`, `inventory_transaction_id`.
- `is_void, void_reason, voided_at, voided_by, created_by, created_at`.
- RLS por `org_id` con `WITH CHECK`; sin `UPDATE`/`DELETE` directos (todo por RPC).

### `payables` — cuentas por pagar (nueva)
- `id, org_id, category_id, payee (proveedor/beneficiario), description, amount, currency, due_date, status` enum `pending | partial | paid | cancelled`, `amount_paid`, `inventory_transaction_id` (si viene de una compra), `created_by, created_at`.
- El estado se recalcula por trigger al registrar o anular un pago (`account_movements` con `payable_id`).

### Cobros de órdenes
- `payments` sigue igual: ya guarda `bank_account_id`, `amount`, `currency` y `amount_usd`. Solo cambia la etiqueta en la UI ("Cuenta" en lugar de "Método").
- `void_payment`: se quita la restricción de "caja cerrada".

## RPCs (todas `SECURITY DEFINER` con `erp_assert_access`)

- `create_account_movement(org, account, kind, amount, category, description, date, exchange_rate)`: `income`/`expense` (admin y secretaria); `adjustment_*` solo admin, con motivo obligatorio.
- `create_account_transfer(org, from_account, from_amount, to_account, to_amount, date, notes)`: solo admin. Si es la misma moneda, `to_amount = from_amount`. Inserta las dos patas con el mismo `transfer_id`.
- `void_account_movement(movement, reason)`: solo admin; una transferencia se anula completa.
- `get_account_balances(org)`: saldo por cuenta, en su moneda y con su equivalente en USD.
- `get_account_ledger(account, from, to, limit, offset)`: estado de cuenta (pagos + movimientos) con saldo acumulado.
- `create_payable(...)`, `pay_payable(payable, account, amount, exchange_rate)` (crea el gasto y actualiza el estado), `cancel_payable(payable, reason)`.
- `register_purchase` (se amplía): nuevo `p_account_id` opcional; con cuenta → crea el gasto "Insumos y reactivos" ligado a la transacción del Kardex; sin cuenta → crea un `payable`. El bioanalista siempre genera "por pagar".
- `get_finance_dashboard(org, month)`: ingresos, egresos, ganancia (USD), saldos, gastos por categoría, serie de 6 meses, por pagar próximo y vencido, cuotas próximas y vencidas.

**Multimoneda:** cada gasto o ingreso en Bs guarda su equivalente en USD con la tasa del día (precargada igual que en el cobro, editable). Ingresos del mes = cobros de órdenes (`payments.amount_usd`) + otros ingresos; egresos = gastos (incluidas las compras de inventario pagadas). Ganancia = ingresos − egresos (base caja: lo que entró menos lo que salió).

## Pantallas

1. **Cuentas** (`/erp/accounts`, reemplaza `/erp/bank-accounts`): tarjetas con el saldo de cada cuenta y el total en USD; botones **Gasto**, **Ingreso**, **Transferencia** y **Ajuste**. Al entrar a una cuenta se ve su estado de cuenta (filtro por fechas, saldo acumulado, exportar PDF/Excel).
2. **Movimientos** (`/erp/movements`): todos los movimientos, con filtros por cuenta, tipo, categoría y fecha.
3. **Por cobrar** (`/erp/receivables`, reemplaza Cuentas por cobrar): pestaña **Cuotas** (todas las cuotas pendientes de todas las órdenes, con filtros "vencidas", "esta semana" y "este mes", y el botón **Cobrar** ahí mismo) y pestaña **Saldos pendientes** (órdenes con saldo y sin cuotas). Se conserva la antigüedad de saldos.
4. **Por pagar** (`/erp/payables`): pendientes y vencidos, con botón **Pagar** (elige cuenta y monto; permite pago parcial).
5. **Dashboard** (`DashboardPage`, solo admin): ingresos, egresos y ganancia del mes; saldos por cuenta; ingresos vs. egresos de 6 meses; gastos por categoría; por cobrar y por pagar vencidos; últimos movimientos.
6. **Inventario**: igual que hoy. El diálogo de compra agrega "Pagar desde la cuenta…" o "Queda por pagar".

## Fases

1. **Cuentas y movimientos**: migración (saldo inicial, categorías, movimientos, transferencias, saldos, estado de cuenta) + página Cuentas + Movimientos; "Método" pasa a "Cuenta" en el cobro. Quitar caja (UI, ruta, menú, PDF, hooks, query keys; `void_payment` sin chequeo de caja).
2. **Por pagar + compras de inventario conectadas**: tabla `payables`, RPCs, página Por pagar, `register_purchase` con cuenta o por pagar.
3. **Por cobrar**: vista de cuotas y saldos con cobro directo.
4. **Dashboard financiero**: RPC + widgets; reemplaza la pestaña "Finanzas" de Reportes (se quedan Rentabilidad, Inventario y Antigüedad).
5. **Cierre**: actualizar `ERP.md`, `docs/ERP_GUIA_USUARIO.md`, smoke test y checklist; prueba en local con el lab demo; datos de Lab Instumed (métodos actuales → cuentas con saldo inicial 0 o el que definan).

Cada fase: migración + test SQL en `supabase/tests/` (rollback, imprime `... passed`), regenerar tipos, tests unitarios de los helpers nuevos, `lint`/`typecheck`/`build`. Todo en local; sin `push` ni `db push` a producción hasta el release.

## Pendiente de confirmar

- ¿La secretaria ve los saldos de las cuentas? (supuesto: no).
- ¿Los gastos en Bs toman la tasa del día por defecto? (supuesto: sí, editable).

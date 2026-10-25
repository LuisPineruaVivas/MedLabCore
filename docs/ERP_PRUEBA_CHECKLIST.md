# ERP online test checklist — Lab Instumed

**Where to test:** https://med-lab-core-git-dev-luis-pineruas-projects.vercel.app (the `dev` preview)
**Test lab:** Lab Instumed
**Date:** ____________

How to fill it in: in the **Result** column, write ✅ (works) or ❌ (fails). For every ❌, describe what happened in **Notes** (exact error message or a screenshot name).

> ⚠️ **While ERP is ON for Lab Instumed, use ONLY the preview link above for that lab.**
> On the live site (`med-lab-core.vercel.app`), Instumed's bioanalyst will **not** be able to "Aprobar y Firmar" orders: the live app doesn't have the ERP approval step yet, and the database now requires it in ERP labs. Your other labs are not affected.

---

## Part A — Prepare Lab Instumed (as super admin)

| # | Step | Result | Notes |
|---|---|---|---|
| A1 | Open the preview link and log in as **super admin**. |✅ | |
| A2 | Go to **Laboratorios**, find **Lab Instumed**, click the **ERP** button → it shows *"ERP activado"*. Do this **only** for Lab Instumed. |✅ | |
| A3 | Make sure Lab Instumed has (or create in **Settings → Team**): a **lab admin**, a **secretary**, a **bioanalyst** and a **lab_affiliate**. | ✅| |

## Part B — Configure the ERP (as Lab Instumed's admin)

| # | Step | Result | Notes |
|---|---|---|---|
| B1 | The **ERP section appears in the menu** (side menu on computer, bottom menu on phone). |✅ | |
| B2 | **Bank accounts** (`/erp/bank-accounts`): add at least two payment methods (e.g. "Efectivo USD", "Pago móvil Bs"). |❌| It does not let me Save a payment method with Moneda equal Bs just let me save if I input USD in the moneda fiels, also when I am gping to edit the payment method is not showing maybe becuase in the database is mobile payment and here is Pago movil so they are not matching in the front so when I click edit it does not anything |
| B3 | Set today's **exchange rate** (USD → Bs). | | How do I Set today's **exchange rate**? also I think this is not neccessary right now the exchange rate is being loaded by an API, maybe you can check that how the exchange rate is now being used and use it that way, becuase that way is automatic the user does not have to set the exchange rate everyday|
| B4 | **Inventory** (`/erp/inventory`): create 2–3 supplies (e.g. "Tubo rojo", "Reactivo glucosa") and register a purchase so they have stock. |✅ |Works but "unidad de medida does not appear when I am going to edit a supply also the calculates when I enter a supplies are not working, for example a create a supply called "inyectadora" the unit is "paquetes" and the "unidades por empaque" is 10 but when I create I see Stock 2 paquetes not 20 "inyectadora" so how is this units and units per package work? am I making a mistake? but I dont see the use of this unit and units per package in this case, also if I am going to add that suply to a test it ask me for "paquetes" which I wont use becuase I will user just one or two "inyectadora" for the test not a whole package, should I create this suply not as "paquetes" but as "unidades" if that is the case when it is helpful to use "paquetes" or "cajas"|
| B5 | Give one test a **recipe** (which supplies it consumes), e.g. Glicemia = 1 tubo rojo + reagent. | ✅| |

## Part C — A normal workday

| # | Who | Step | Result | Notes |
|---|---|---|---|---|
| C1 | Secretary | **Cash register** (`/erp/cash-register`) → **open the cash session** with a starting amount. | ✅| |
| C2 | Secretary | Create 2–3 orders for a test patient → each order automatically creates an **invoice** (check **Invoices**). |✅ | |
| C3 | Secretary | Charge one invoice **fully** in USD, and another **partly** (half USD, half Bs) → its status becomes *partial*. |✅ | |
| C4 | Secretary | **Void (anular)** one payment → the invoice balance goes back up. |✅ | |
| C5 | Bioanalyst | Enter results on an order → **approve and sign** → it asks to **confirm supply consumption** → confirm → order is "completada". |✅ | |
| C6 | Lab admin | **Inventory**: the stock of the recipe's supplies went down. | ✅| |
| C7 | Secretary | **Close the cash session** → expected vs counted totals make sense. | ✅| |
| C8 | Lab admin | **Review** the closed cash session. | ✅| The cash session works, but I dont see why this is useful? can i just manage the order and bills without opening or closing a cash session? I dont knoe why this step of the cash session is necessary if you have any idea let me know|

## Part D — Reports (as lab admin)

| # | Step | Result | Notes |
|---|---|---|---|
| D1 | **Reports** (`/erp/reports`): today's collections, invoices and profitability show the numbers from Part C. |✅ | |
| D2 | **Accounts receivable** (`/erp/accounts-receivable`): the partly-paid invoice appears with the right pending balance. |✅ | |
| D3 | Download/print an invoice or report PDF → it shows Lab Instumed's logo and data. | ✅| |

## Part E — Permissions (each role sees only what it should)

| # | Step | Result | Notes |
|---|---|---|---|
| E1 | **Bioanalyst** and **lab_affiliate** do **not** see invoices, payments, bank accounts or reports. | ❌|  byonalys can see reports page (erp/reports), just the Inventory part but I think that is an issue should not see any of reports|
| E2 | **Secretary** can charge and use the cash register, but **cannot** see financial reports. | ✅| |
| E3 | **Secretary** cannot approve and sign orders (only the bioanalyst can). |✅ | |

## Part F — Nothing else changed

| # | Step | Result | Notes |
|---|---|---|---|
| F1 | On the preview, log in as a user of a **real** lab (not Instumed) → looks like before: no ERP menu, orders work normally. | ✅| |
| F2 | Patient portal on the preview (`/portal-paciente?org=…` of a real lab) → logo, colors and results show. | ✅| |
| F3 | Thermal receipt and the Word/DOCX report (new from `dev`) → both print/download fine. |✅ | Works but they are not necessary |

---

## Re-test after the fixes (commit 716e3c9)

First deploy the database change (only once): `npx supabase db push --dry-run` must list only `20261025000000_erp_reports_lab_admin_only.sql`, then `npx supabase db push`.

| # | Who | Step | Result | Notes |
|---|---|---|---|---|
| R1 | Lab admin | **Bank accounts**: create "Pago móvil Bs" with **Moneda = Bolívares (Bs)** → it saves and the card says "Pago móvil · Bolívares (Bs)". | ✅| |
| R2 | Lab admin | Click ✏️ on that method → the form shows **Pago móvil** and **Bolívares (Bs)**. Change the name, save → it updates. |✅ | |
| R3 | Lab admin | Try to save a method with an empty name → a red message appears (it no longer fails silently). |✅ | |
| R4 | Lab admin | **Inventory**: edit "inyectadora" → the form shows its saved **unit of measure**. Set unit = **uds** and units per package = **10**, save. |✅ | |
| R5 | Lab admin | **Registrar compra** of inyectadora → choose **"Empaques de 10 uds"**, quantity **2**, cost per package **5** → the preview says "2 empaques × 10 = 20 uds · Costo por uds: $0.50" → save → stock goes up by **20**. |✅ | |
| R6 | Lab admin | Same purchase dialog with **"uds"** selected, quantity 3 → stock goes up by **3**. | ✅| |
| R7 | Lab admin | Recipe of a test using inyectadora: quantity **1** (uds) → approve an order with that test → stock goes down by **1**. | ✅| |
| R8 | Bioanalyst | The menu has **Inventario** but **no Reportes**; typing `/erp/reports` in the address bar sends you away. |✅ | |
| R9 | Bioanalyst | **Inventario** still works (see supplies, register a purchase). | ✅| |
| R10 | Lab admin | **Reportes** still shows all 4 tabs, including **Inventario**. |✅ | |

## When you finish

- [ ] Turn **ERP off** for Lab Instumed (**Laboratorios** → ERP button → *"ERP desactivado"*) if you want to use Instumed on the live site again. ERP data (invoices, payments, stock) is kept and comes back if you turn it on later.
- [ ] Send the results to Claude. If everything is ✅, next step is planning `dev` → `main` (backup first, quick checklist after).

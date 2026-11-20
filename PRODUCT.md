# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Bioanalysts** (heaviest daily use): enter and review results, approve and sign orders, confirm supply consumption. They work at a desktop PC or a tablet inside the lab, between bench tasks.
- **Lab owners / admins**: follow the lab's money (income, expenses, balances, receivables, payables), inventory and orders, often from a phone outside the lab.
- **Secretaries (front desk)**: register patients, create orders, collect payments and record expenses.
- **Affiliate labs**: order tests for the patients they refer.
- **Patients**: open the public portal with their ID and per-order PIN to see and download results, on their phones.
- **MedLabCore staff (super admin)**: provision labs and users, impersonate, manage global test templates.

## Product Purpose

Multi-tenant SaaS that runs a clinical laboratory end to end: patients, orders, test templates, results entry, signed PDF result reports, billing, a patient portal, and an optional administrative module (ERP: accounts and movements, receivables, payables, inventory with Kardex and per-test supply recipes, financial dashboard). Success: a lab runs its whole day in the app, results go out correct and signed, and the owner always knows how the lab is doing.

## Positioning

Built for Venezuelan clinical labs: dual currency (USD and bolívares at the day's BCV rate), each lab's own report layouts, supply consumption tied to every test, and a patient portal secured by ID + per-order PIN.

## Operating Context

- Spanish UI. Money in USD and VES (Bs); the day's exchange rate is fetched automatically and stays editable.
- Roles: super_admin, lab_admin, bioanalyst, secretary, lab_affiliate; each sees only what its role allows.
- Installed as a PWA; thermal receipt printing via Web Serial; PDF result reports in LETTER size.
- Desktop and tablet in the lab; phones for owners on the move and for patients.

## Capabilities and Constraints

- React SPA (Vite, Tailwind, shadcn/ui on Radix) on Supabase; deployed on Vercel with a strict CSP (new external origins must be added to `vercel.json`).
- Each lab has its own name, logo and colors (`organizations.primary_color` / secondary, applied by `BrandContext`). The app's interface takes each lab's color.
- PDF result report layouts differ per lab on purpose and must never be unified.
- The ERP module is feature-flagged per lab (`has_erp_module`).
- Undecided: whether patients and affiliate labs get distinct visual treatment from staff screens.

## Brand Commitments

- Product name MedLabCore; logo at `public/logo.png`.
- Each lab's own color and logo carry through the app (confirmed by the user, 2026-11-13).

## Evidence on Hand

- Real lab data exists only in the local, git-ignored `supabase/seed.sql`; the demo ERP lab is in `supabase/seed_erp_demo.sql`. No testimonials, metrics or case studies are on hand; do not invent them.

## Product Principles

1. The bench comes first: result entry and signing must be fast, unambiguous and hard to get wrong.
2. Money is always clear: which currency, which account, at what rate.
3. Each lab feels it is their own system: their color, their logo, their report layout.
4. Every role sees only its work; nothing extra to learn.
5. Works on the device at hand: PC and tablet in the lab, phone outside it.

## Accessibility & Inclusion

WCAG 2.1 AA (requested by the user, 2026-11-13). Lab colors chosen by each lab must still meet contrast for text and controls.

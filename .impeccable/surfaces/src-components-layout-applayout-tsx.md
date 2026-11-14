---
version: 1
slug: "src-components-layout-applayout-tsx"
primary_target: "src/components/layout/AppLayout.tsx"
related_targets: ["src/index.css"]
---

# Surface: app shell and base system (all staff screens)

Mode: Operate. Scope: theme tokens (light and dark), lab-color theming, header, sidebar, mobile bar, shared components; then Pacientes, Órdenes, Detalle de orden.

Audience and job: bioanalyst at a lab PC/tablet entering, validating and signing results; owner on a phone checking money and orders; front desk registering and collecting.

Constraints: WCAG 2.1 AA; each lab's color drives the interface and must keep contrast; PDF report layouts untouched; Spanish copy; existing behavior and routes preserved.

## Direction contract

THESIS: State is read by depth. Pending work sits pressed into the surface, validated and signed work rises; the app refuses the flat white card grid with KPI tiles on top.

OWN-WORLD: One molded material per theme (light porcelain #e6ebf0 family, dark slate #161c24 family), every surface extruded from the ground with paired light/dark shadows, inputs and value wells pressed inset, every control keeps a 1px edge of at least 3:1. The lab's own color is the only ink: primary actions, active nav, focus ring, selection. Semantic state colors only where they mean state. Workhorse sans, tabular figures.

STORY: The visitor sees what needs them (pending, to validate) before anything else, acts in one place, and sees the item rise when it is done.

FIRST VIEWPORT: Molded left rail (logo, lab name, grouped nav), compact top bar (page title, search, primary action, theme toggle), an inset segmented status strip with counts, then raised rows; on the order detail, results sit in inset wells beside their reference range, with "Aprobar y firmar" as the single primary action. Phone: compact header, bottom bar, one focus per screen.

FORM: Soft clinical neumorphism, position 6 of 7 on the grounded list; seed:51479d554c157a65. Raises: state said once (Saville); fixed order lifecycle strip (botanical folio); hierarchy by scale, large tabular numbers (specimen); one focus per screen on phone (feed).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

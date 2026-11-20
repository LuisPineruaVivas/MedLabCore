---
name: MedLabCore
description: Soft clinical neumorphism for a lab's working day; state is read by depth, the lab's own color is the only ink.
colors:
  porcelain-ground: "#e6eaef"
  porcelain-raised-popover: "#f2f4f8"
  graphite-ink: "#151d28"
  muted-ink: "#4f5a69"
  porcelain-secondary: "#dae0e7"
  porcelain-muted: "#d7dde4"
  hairline: "#c9d0d9"
  slate-edge: "#6e7d91"
  shade: "#a8b6c7"
  highlight: "#ffffff"
  lab-teal: "#0b756a"
  lab-teal-ink: "#ffffff"
  teal-wash: "#cdeae7"
  teal-wash-ink: "#095d55"
  clinical-red: "#b62020"
  result-green: "#147145"
  amber-pending: "#9a4f04"
  signal-blue: "#195cb3"
  slate-ground: "#181d26"
  slate-raised-popover: "#202732"
  frost-ink: "#e9edf2"
  frost-muted-ink: "#a7b1be"
  slate-secondary: "#232a34"
  slate-hairline: "#2c343f"
  slate-edge-dark: "#677383"
  slate-shade: "#06090e"
  slate-highlight: "#384351"
  night-teal: "#41c8b6"
  night-teal-ink: "#0e131b"
  night-teal-wash: "#24423e"
  night-red: "#ef6c6c"
  night-green: "#4dcb90"
  night-amber: "#f5b13d"
  night-blue: "#71acf4"
typography:
  headline:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  subtitle:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  result-value:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
    fontFeature: "tnum"
  body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  page-phone: "12px"
  page: "24px"
  card: "24px"
  row: "16px"
  stack: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.lab-teal}"
    textColor: "{colors.lab-teal-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.porcelain-ground}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.xl}"
    height: "40px"
  input-field:
    backgroundColor: "{colors.porcelain-ground}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
    height: "40px"
  result-well:
    backgroundColor: "{colors.porcelain-ground}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.result-value}"
    rounded: "{rounded.xl}"
    height: "44px"
  card:
    backgroundColor: "{colors.porcelain-ground}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  status-strip:
    backgroundColor: "{colors.porcelain-ground}"
    rounded: "{rounded.2xl}"
    padding: "6px"
  status-segment-active:
    backgroundColor: "{colors.porcelain-ground}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.xl}"
    padding: "8px 14px"
  nav-item-active:
    backgroundColor: "{colors.porcelain-ground}"
    textColor: "{colors.lab-teal}"
    rounded: "{rounded.xl}"
  status-badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
---

# Design System: MedLabCore

## Overview

**Creative North Star: "The Molded Bench"**

The interface is one continuous material per theme, light porcelain or dark slate, and every surface is either extruded from that ground or pressed into it. Depth is not decoration here; it is the status channel. Work that still needs the bench (pending, awaiting approval) sits pressed in; finished, validated and signed work stands raised. A bioanalyst scanning a list reads state by relief before reading a single badge, and the one primary action ("Aprobar y firmar", "Nueva orden") is the only filled, inked control in view.

Color is almost absent. The lab's own brand color is the only ink, recalculated per lab so it stays WCAG AA as text on both grounds, and it marks only the primary action, the active place, the focus ring and the selection. Semantic red, green, amber and blue appear only where they mean a state (out of range, completed, pending, affiliate). Density is operational, not airy: compact 56px top bar, a 240px molded rail, tables and result rows with tabular figures throughout.

The system was born to replace the flat white card grid with KPI tiles on top; it carries a light and a dark theme of equal standing, switched by the user (light, dark, or follow the device).

**Key Characteristics:**
- One molded ground per theme; surfaces raised or inset, never floating on a different color.
- State by depth: pressed means waiting, raised means done.
- The lab's color is the only ink, auto-fitted to AA in light and dark.
- Every field and outline control keeps a 1px slate edge of at least 3:1; shadows never carry meaning alone.
- Public Sans with tabular figures for every number, result and amount.
- Pages appear at once; the only authored motion is a change of depth.

## Colors

A near-monochrome molded ground in cool porcelain or slate, inked by a single per-lab color and four state colors that never decorate.

### Primary
- **Lab Teal** (lab-teal; night-teal in dark): the default lab ink, used when a lab has no color of its own. In production `--primary`, `--ring`, `--accent` and the sidebar/chart equivalents are overwritten per lab by `labThemeVars` (src/lib/labTheme.ts) through BrandContext: the lab's hue is kept, lightness is walked down until it reaches 4.5:1 against the light ground and up until 5:1 against the dark ground (saturation capped at 75%). White ink sits on the light-theme primary, near-black ink (night-teal-ink) on the dark one. Used for: the single filled primary button, the active nav item's text and icon, the focus outline, text selection (22% tint), order numbers, active segment counts, links.
- **Teal Wash** (teal-wash / night-teal-wash, ink teal-wash-ink): the low-chroma tint of the lab hue for selected table rows and focused menu items.

### Secondary
- **Clinical Red** (clinical-red / night-red): destructive actions, out-of-range results ("Fuera de rango"), cancelled orders.
- **Result Green** (result-green / night-green): completed and signed status, positive trend.
- **Amber Pending** (amber-pending / night-amber): pending status.
- **Signal Blue** (signal-blue / night-blue): in-process and to-approve status, affiliate origin.

State colors appear as text plus a 10% tint fill and 20% border in status badges, never as large fills.

### Neutral
- **Porcelain Ground** (porcelain-ground; dark: slate-ground): page, card, sidebar and field background; the one material everything is molded from. Cards share the ground color exactly; only their shadow lifts them.
- **Raised Porcelain** (porcelain-raised-popover; dark: slate-raised-popover): the one exception to a single ground, for floating layers (dialogs, popovers, menus, the phone action bar) that are not molded but lifted off the work.
- **Graphite Ink** (graphite-ink; dark: frost-ink): all body text and headings.
- **Muted Ink** (muted-ink; dark: frost-muted-ink): secondary text, labels, units, reference ranges, dates. Both clear 4.5:1 on their ground.
- **Porcelain Secondary / Muted** (porcelain-secondary, porcelain-muted; dark: slate-secondary): ghost hover, secondary buttons, table footers.
- **Hairline** (hairline; dark: slate-hairline): the 1px border on cards, rows, header and rail; structure, not affordance.
- **Slate Edge** (slate-edge; dark: slate-edge-dark): the `--input` edge on every field, select and outline button; at least 3:1 against the ground.
- **Shade / Highlight** (shade + highlight; dark: slate-shade + slate-highlight): the two halves of every molded shadow (`--neu-lo`, `--neu-hi`). Light falls from the top-left. Dark theme uses a lifted slate highlight because pure white would glare and black would vanish.

### Named Rules
**The Only Ink Rule.** The lab's color is the only hue that is not a state. If something is colored and it is not the primary action, the active place, the focus or the selection, it must be a state.

**The Fitted Ink Rule.** Never apply a lab's raw brand hex to the interface. Pass it through `labThemeVars`, which keeps the hue and moves lightness until it is text-grade on each ground.

**The State Means State Rule.** Red, green, amber and blue are reserved for result and order states. They do not decorate icons, headers or charts of non-state data.

## Typography

**Display Font:** none; the system has no display tier.
**Body Font:** Public Sans (with system-ui, sans-serif), weights 400/500/600/700.
**Label/Mono Font:** JetBrains Mono, opt-in only through the `.mono` utility for codes.

**Character:** A plain, public-service workhorse sans, chosen to read numbers without ambiguity at bench distance. Every `td`, `th`, `input` and `.tabular` element uses tabular figures so results, amounts and dates line up in columns.

### Hierarchy
- **Headline** (700, 24px, tight tracking): the page title ("Órdenes", "Orden #0003"), one per screen, balanced wrap.
- **Title** (600, 18px): card and dialog titles ("Paciente", "Orden").
- **Subtitle** (600, 16px): test names inside the results panel ("Hematología Completa"); section names drop to 14px semibold muted with a hairline underneath ("Serie roja").
- **Result Value** (600, 18px, tabular, right-aligned): the number inside a result well; the largest figure on the detail screen, deliberately bigger than its label.
- **Body** (400–600, 14px): table cells, form labels, buttons (600), descriptions. Inputs render 16px on phones to avoid zoom, 14px from md up.
- **Label** (500, 12px): field captions above values in the order sidebar ("Cédula", "Total USD"), units, reference ranges on phones, rail section headings, footer.
- Bottom bar labels drop to 11px; nothing else goes below 12px.

### Named Rules
**The Tabular Rule.** Every number a lab reads (results, references, amounts in USD and Bs, order numbers, dates, counts) is set in tabular figures.

**The Scale Not Color Rule.** Hierarchy comes from size and weight. Emphasis is never gradient text; `.text-gradient-primary` resolves to flat lab ink.

## Layout

Fixed shell, fluid work area. From 768px (md) up: a fixed left rail of 240px (68px collapsed, toggled from the rail foot and remembered in the layout store) and a sticky 56px top bar carrying the date, theme toggle and user controls. Below 768px the rail is gone: a compact header shows the lab logo and name, and a fixed 56px bottom bar carries four main destinations plus "Menú", which opens a bottom drawer with every section; the nav for rail, bar and drawer is one definition (`useNavigation`).

Page padding is 12px on phones and 24px from 640px up; phone pages reserve 80px at the bottom for the bar. Vertical rhythm between page blocks is 16px on phones and 24px from 640px up. Cards pad 24px; card headers in list screens use 16px vertical, 16–24px horizontal.

Lists switch form at md: a table from 768px, a stack of 12px-spaced row cards below. The order detail is two columns on desktop (order sidebar beside the results panel), one column on tablet and phone. Result rows are a three-column grid (label, 160px well, reference range) from 640px; on phones the reference wraps below the well.

**The One Focus Rule (phone).** On phones a screen has one job: the order detail's save and approve move out of the header into a fixed action bar above the bottom nav, and the header copies are hidden so the action never appears twice.

## Elevation & Depth

This is a molded system: every elevation is a pair of shadows, a shade to the bottom-right and a highlight to the top-left, on a surface that shares the ground's color. Shadows express material and state; a 1px edge always duplicates the boundary so nothing depends on the shadow to be seen.

### Shadow Vocabulary
- **Raised small** (`3px 3px 7px shade/0.85, -3px -3px 7px highlight/0.9`): the resting lift for cards, the rail, select triggers, primary buttons, active status segments, row cards.
- **Raised** (`6px 6px 14px shade/0.9, -6px -6px 14px highlight/0.9`): the strongest in-plane lift, for a finished order's number chip in the table.
- **Inset** (`inset 3px 3px 7px shade/0.8, inset -3px -3px 7px highlight/0.9`): pressed into the ground; text fields, textareas, result wells, the status strip track, active nav items, icon wells, pending order chips and pending row cards, and every button while pressed.
- **Elevated** (`10px 10px 24px shade/0.9, -8px -8px 20px highlight/0.9`): only for layers that leave the plane: dialogs, popovers, select menus, dropdown menus, the phone action bar and the menu drawer, always on the raised popover color.
- **Pending band** (table rows only): a shade tint (16% light, 55% dark) plus a 9px top-edge shade gradient, so a whole waiting row reads sunken without per-cell seams.

### Named Rules
**The Depth Is State Rule.** Pressed means it waits for someone (pending, to approve, the place you are, a value to fill). Raised means it is done or actionable. Never raise pending work or press finished work.

**The Earned Lift Rule.** Raised depth is reserved for the primary action, finished work and containers. Outline, secondary and ghost buttons stay flat at rest and only press in when pushed.

**The Edge Backs the Shadow Rule.** Every field, select and outline button keeps a 1px slate edge (at least 3:1). Shadows are allowed to fail (dark mode, high contrast, print) without the control disappearing.

## Shapes

Soft, pillowy rectangles; no sharp corners and no pills except badges and the switch. Controls (buttons, fields, selects, wells, nav items, status segments) round at 12px; containers (cards, the status strip, row cards, the phone action bar) round at 16px; the menu drawer rounds its top at 24px. Small inline chips (order numbers, icon wells, logo tiles) round at 8–14px. Status badges and the switch are full pills. Borders are 1px everywhere; there are no double borders, no left-stripe accents and no clipping shapes.

## Components

### Buttons
Tactile and quiet: one inked button per view, the rest recede.
- **Shape:** gently rounded (12px), 40px tall (36px small, 44px large, 40px square icon).
- **Primary:** filled lab ink with white (light) or near-black (dark) text, 600 weight, raised small; hover drops to 90% ink; pressing swaps the lift for the inset shadow. One per view.
- **Outline:** ground fill, slate edge, graphite text; hover inks the text; pressed goes inset. The workhorse for secondary actions ("Ver informe", "Guardar cambios").
- **Secondary:** secondary fill with hairline edge; same hover and press.
- **Ghost:** no fill or edge at rest; secondary fill on hover; used for icon actions (theme toggle) and "Volver".
- **Destructive:** filled clinical red, raised small, same press behavior.
- **Focus:** 2px lab-ink ring with 2px offset on every button. Disabled drops to 50% opacity.

### Chips (status badges)
- **Style:** full pill, 12px medium text, state color text on a 10% state tint with a 20% state border.
- **State:** Pendiente amber, Procesando and Por aprobar blue, Completada green, Cancelada red. No neutral decorative badges.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** the ground itself (never white on grey).
- **Shadow Strategy:** raised small at rest; see Elevation & Depth.
- **Border:** 1px hairline.
- **Internal Padding:** 24px; card headers in list screens 16px vertical.

### Inputs / Fields
- **Style:** inset well on the ground, 1px slate edge, 12px radius, 40px tall, muted placeholder.
- **Select trigger:** same edge and size but raised small, because it opens something; inside result wells it is forced inset to match.
- **Focus:** 2px lab-ink ring, 2px offset.
- **Error / Disabled:** errors switch edge and text to clinical red; disabled fields drop to 50% opacity, except read-only results (below).

### Navigation
- **Rail:** molded 240px rail on the ground with a hairline right edge and raised-small lift; lab logo tile (raised, white behind the logo) or the lab's initials on lab ink, lab name in 14px bold, grouped items under 12px semibold muted section headings in sentence case. Items are 18px icon plus 14px label; hover shows the secondary fill; the active item is pressed inset with lab-ink text and icon, semibold.
- **Top bar:** sticky 56px on the ground, hairline bottom edge; date on the left (desktop), theme toggle and user controls right.
- **Bottom bar (phone):** fixed 56px with a soft upward shade; 20px icons over 11px labels; the active entry turns lab ink and semibold. "Menú" opens a bottom drawer on the raised popover color with 24px top corners, a grab handle, every section and "Cerrar sesión" in red.
- **Theme toggle:** ghost icon button showing sun or moon; a menu offers Claro, Oscuro and Como el dispositivo.

### Status Strip (signature)
The order list opens on an inset segmented track (16px radius, slate edge, 6px padding) holding every status with its count. The selected segment rises out of the track (card fill, hairline, raised small, semibold) and its count turns lab ink; the others sit flat in muted ink. On first load the strip selects the work that waits (pending, then to approve). Two-column grid on phones with "Todas" spanning both, a single row from 640px.

### Depth-as-State Rows (signature)
In the order table each pending or to-approve row is a sunken band (Pending band shadow), and its order-number chip is pressed inset; finished rows sit on the plain ground with a fully raised chip. On phones each order is a 16px row card: inset when it waits, raised small when done. Changes animate through the rise transition (220ms, expo-out).

### Result Wells (signature)
Each analyte is a row: label with unit in 12px muted, a 44px right-aligned well holding the value in 18px semibold tabular figures, and the reference range ("Ref. 13.5-17.5") beside it in muted tabular text. Out of range turns the well's edge and value clinical red and adds "Fuera de rango" in red semibold under the range. A lab-defined category color may tint a value. Once an order is signed, wells flatten: no edge, no shadow, no placeholder, full-contrast value, so recorded results read as facts rather than inputs.

### Phone Action Bar (signature)
On the order detail below 768px, a 16px-radius bar on the raised popover color with the elevated shadow floats 8px above the bottom nav, holding "Guardar (n)" as outline and the forward action ("Aprobar y firmar") as the one primary button, each half width. The header's own save and approve are hidden on phones.

## Do's and Don'ts

### Do:
- **Do** read state by depth: pending and to-approve work pressed inset, finished and signed work raised.
- **Do** derive every lab color through `labThemeVars` so it is 4.5:1 on the light ground and 5:1 on the dark ground before it touches the interface.
- **Do** keep a 1px slate edge (at least 3:1) on every field, select and outline button, in both themes.
- **Do** use exactly one filled primary button per view; every other action is outline, secondary or ghost.
- **Do** set every result, amount, count and date in tabular figures, results at 18px semibold right-aligned with their reference range beside them.
- **Do** design every new screen in both themes; molding uses the theme's own shade and highlight, never fixed black or white.
- **Do** keep page entrances instant; animate only depth changes (220ms, cubic-bezier(0.16, 1, 0.3, 1)) and honor reduced motion.
- **Do** give phones one focus per screen, moving the screen's main actions into a fixed bar above the bottom nav and hiding their header copies.

### Don't:
- **Don't** build the flat white card grid with KPI tiles on top; cards share the ground color and lists open on the status strip.
- **Don't** apply a lab's raw brand hex, a second brand color, or any decorative hue to the interface.
- **Don't** use red, green, amber or blue for anything other than the state it names.
- **Don't** raise outline, secondary or ghost buttons at rest; lift is earned.
- **Don't** let a shadow be the only boundary of a control.
- **Don't** use gradient text, white cards on a grey page, or entrance animations on page load.
- **Don't** change, restyle or unify the per-lab PDF result report layouts (default, rivalta, palermo); they are outside this system and differ on purpose.

## Coverage

The base system (tokens, lab theming, theme switch, shell, shared primitives) and three screens were redesigned and reviewed: Órdenes, Pacientes and Detalle de orden.

A second pass (2026-11-13) brought every other screen onto the system without recomposing it:
- Hard-coded Tailwind palette colors were mapped to the role tokens (red → destructive, green → success, amber → warning, blue/purple → info, neutrals → foreground / muted-foreground / secondary / border), so dark mode holds everywhere. Exceptions on purpose: the blood group card (it reproduces a printed card), white grounds behind logos, the report and signature previews (paper), and everything in `src/lib` (PDF documents).
- Bolívar amounts read "Bs 1.234,56" (`formatCurrency(x, "VES")`); screen money uses es-VE grouping instead of `toFixed(2)`; `.mono` is tabular sans, not a monospace face.
- StatCard is compact on phones, page-header actions wrap, and secondary table columns hide below `sm` on Facturas, Movimientos and Por pagar.
- Text under 12px was raised to `text-xs`, except the documented 11px bottom-bar labels.

Still pending: the dashboard, exams, billing, ERP, settings, login and patient portal keep their original compositions (KPI-tile rows on dashboard, billing, exams and inventory; wide tables that scroll on phones). Treat those compositions as pending, not as examples of this system. A few 9px labels remain.

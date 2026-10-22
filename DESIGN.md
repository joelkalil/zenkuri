# Zenkuri — Hanko + Strategy Guide

Direction approved on October 20, 2026 (A + C, "Hanko + Strategy Guide"). Fully replaces the "Launcher" direction of October 16, 2026 (launcher frame, Epic blue, status bar). Existing calculations, integrations, data, filters and actions are preserved. Source of truth: the code (`src/index.css`, `src/gallery.css`, `src/styles/`); the brief and brand files live in `.artefacts/designs/2026-10-20-brand/` (`brief.md`, `assets.md`, `wireframes.md`).

## Overview

**Zenkuri = 全クリ (zenkuri)**, Japanese gamer slang for "100% complete". The app is the personal record of those completions, and the identity comes from two Japanese objects:

- **Hanko (A):** the vermilion (朱) ink seal. Each platinum or 100% is a dated stamp, as in a logbook.
- **Strategy guide (C):** a printed magazine. Strong typographic hierarchy, numbered sections, rules instead of boxes, dense tables, tabular numerals.

Principles: a single accent (vermilion); paper and ink (warm neutrals: sumi in dark, paper in light); flat, with no gradient, neon or glow — the game art is the only decoration; planning first, with dense, aligned information.

**Structure.** No launcher frame: content sits directly on the canvas, separated by rules. Navigation has 4 groups (`src/components/nav.ts`), with a subnav per group; `/game/*` belongs to Library, `/sagas/*` and `/comunidade` to Community, and `/settings` lives in the profile menu. Labels are shown in English with the current pt-BR label in parentheses on first mention.

| Group | Destinations |
|---|---|
| Today (Hoje) | Today (`/`), Plan (Plano) |
| Library (Biblioteca) | Games (Jogos), Collections (Coleções) |
| Achievements (Conquistas) | Hall, Rankings, Almanac (Almanaque) |
| Community (Comunidade) | Community, Sagas |

56px top bar (brand, 4 uppercase groups with an accent underline on the active one, `SyncButton` (labelled "Update"), level chip, `ProfileMenu`) and a 40px subnav with an underline on the active item. The `ProfileMenu` gathers profile, platforms, Settings (Ajustes), Tutorials (Tutoriais) and appearance. Below 768px the navigation becomes a bottom `TabBar` and the profile opens as a sheet. While an update runs, `UpdateProgressToast` (popover style, fixed bottom-left, above the `TabBar` on phones) shows one row per source with a step label, a 3px accent bar and the percent; it closes itself 5s after a clean finish and stays open on error until closed.

## Colors

Two themes in `src/index.css` (`data-theme`), both remapping `--color-gray-*` and `--color-violet-*` (= vermilion accent). In the light themes the gray scale is **inverted** (gray-50 = strongest ink, gray-950 = canvas). Default: `zenkuri` (dark, "Warm sumi and vermilion"); alternative: `zenkuri-claro` ("Papel", i.e. Paper).

| Role | Token | `zenkuri` | `zenkuri-claro` |
|---|---|---|---|
| Canvas | gray-950 | #121110 | #F3EEE4 |
| Surface | gray-900 | #1A1817 | #FBF8F2 |
| Elevated / row hover | gray-850 | #221F1D | #EAE3D6 |
| Rule | gray-800 | #2E2A27 | #DCD3C5 |
| Strong rule | gray-700 | #4A4540 | #C3B9A8 |
| Faint / control border | gray-600 | #7D766C | #7A7266 |
| Muted | gray-500 | #8F887D | #686157 |
| Secondary text | gray-300 | #C4BCB0 | #433E37 |
| Primary text | gray-100 | #EDE7DD | #1C1A17 |
| Accent (fill) | violet-500 | #E5533A | #B93A23 |
| Accent (link, focus) | violet-400 | #EE6E56 | #B93A23 |
| Primary hover | `--accent-hover` | #EE6E56 | #A23220 |
| Ink on accent | `--zk-accent-ink` | #160B08 | #FFFFFF |

Semantic (`--zk-*`, exposed in Tailwind as `zk-bronze`, `zk-silver`, `zk-gold`, `zk-platinum`, `zk-complete`, `zk-danger`, `zk-accent-ink`):

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--zk-bronze` | #CD8A57 | #8F5424 | bronze trophy |
| `--zk-silver` | #B8BEC6 | #5C646E | silver trophy |
| `--zk-gold` | #E3B341 | #7D5A0A | gold trophy |
| `--zk-platinum` | #9CC4E8 | #2F6592 | platinum (badge `data-tone="platinum"`) |
| `--zk-complete` | #5FB98A | #1F6B44 | 100% complete (jade) |
| `--zk-danger` | #F2766B | #B3261E | error / destructive |

Rules: vermilion is brand and action, not state; the **Platinum stamp** uses vermilion (violet-500) and the **100% stamp** uses jade (`--zk-complete`); the "Platinum" text badge uses the cool blue `--zk-platinum`. Danger always comes with text or an icon, never color alone. Dark ink on the accent in dark mode (white gives only 3.73:1); white in light mode. Control borders use gray-600 (≥3:1); gray-700/800 are decorative rules only. `ThemeContext` offers only these 2 themes; migration version `3` (`zenkuri-theme-version`): on first load `light` becomes `zenkuri-claro` and any old value becomes `zenkuri`; afterwards the user's choice is respected.

## Typography

| Role | Family | npm package |
|---|---|---|
| Display, headings, large numbers | Zen Kaku Gothic New (500/700/900, `latin`) | `@fontsource/zen-kaku-gothic-new` |
| UI text and inline numbers | Inter Variable | `@fontsource-variable/inter` |
| Numeric table columns, section numbers, stamp dates | JetBrains Mono (400/500) | `@fontsource/jetbrains-mono` |

Tokens `--font-display`, `--font-sans`, `--font-mono` in `@theme`; `h1–h3` use display. `body` already applies `tabular-nums`.

**When to use mono:** only (1) numeric table columns, (2) section numbers ("01") and (3) dates inside stamps. Inline numbers in sentences, labels and metadata use Inter with `tabular-nums`, not mono. Use `.num` only in those cases. Large hero numbers: Zen Kaku 900.

Scale: display 48/900; H1 32/700; H2 22/700; H3 16/700 (tracking -0.02 to 0); body 14 Inter; small 12.5; micro 11/600, +0.08em, uppercase (`.micro`, `.col-head`). `.lede` (15px, muted) is the editorial line. No decorative italics and no long uppercase text.

## Layout

- **Page:** `.page` (max 1480px, `.page-narrow` 1180px; pages may set their own max, e.g. Today 1280px), `--page-gutter: clamp(1rem, 2.6vw, 2.5rem)`, header `.page-head`. The app scrolls inside `.app-content`.
- **Numbered sections** (`SectionHead`): "01 · Title" with the number in mono, a rule above; `.rule` (1px gray-800) separates; `.rule-strong` (2px gray-100) only as an opening rule at the top of the page.
- **Radii:** 4px on controls and covers (`--radius-cover`), 8px on panels, 2px on stamps/badges. No nested cards; surface (`.surface`, gray-900) only for popovers, modals, inputs and the fixed detail panel.
- **Breakpoints:** 1280, 1100 and 768px. Below 768px the `TabBar` replaces the top navigation; tables become vertical lists or accordions.
- **Stats:** one editorial line (`.lede` with numbers) or a 2-column sheet separated by rules.
- **Pages:** each has its CSS in `src/styles/<page>.css` (`hoje`, `biblioteca`, `jogo`, `hall`, `plano`, `rankings`, `sagas`, `almanaque`, `ajustes`, `login`); global primitives in `src/gallery.css`; tokens in `src/index.css`. Page styles do not redefine primitives.

## Components

- **Primitives (`src/gallery.css`):** `.btn` (+`.btn-sm`) with variants `.btn-primary`/`.accent-fill`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`; `.badge[data-tone]` (`platinum`, `complete`, `gold`, `danger`, `accent`; 1px outline, no fill); `.rule`, `.rule-strong`; `.micro`, `.num`, `.lede`; `.col-head`; `.row`; `.page`, `.page-head`; `.subtab`; `.segmented`; `.surface`. Primary button: violet-500 fill with `--zk-accent-ink`, one per region. `.stat-tile`/`.stat-strip` are **deprecated** (kept only until migration).
- **Stamp** (`src/components/Stamp.tsx`): `<Stamp kind="platina" | "100" date size={24|48|96} seed />`. Uses the SVGs `/brand/stamp-platina.svg` (vermilion) and `/brand/stamp-100.svg` (jade) with the date in mono (`dd.mm.yy` at 48; `dd.mm.yyyy` at 96; no date at 24). Deterministic rotation from -4° to +4° via a hash of `seed` (game id), never animated, 0° at size 24. `role="img"` with `aria-label`; the status also appears as text in the row. No texture and no glow.
- **SectionHead:** `<SectionHead number="01" title sub action />`.
- **Logo/brand** (`Logo.tsx`, `public/brand/`): square seal with 全 in Zen Kaku 900. Files: `mark.svg`, `mark-16.svg`, `mark-paper.svg`, `mark-mono.svg`, `mark-192.png`, `mark-512.png`, `wordmark.svg`, `wordmark-escuro.svg`, `wordmark-claro.svg`, `stamp-platina.svg`, `stamp-100.svg`. Seal `#E5533A` + glyph `#160B08` in dark; `#B93A23` + white in light. Minimum 16px. Never recolor, rotate more than 4°, or apply shadow, gradient or texture.
- **Today (`/`):** 01 Now, 02 Plan, 03 Almost there, 04 Recent; editorial line of numbers; a single segmented platform control.
- **Game:** compact header; trophy checklist above the fold; sticky "Info sheet (Ficha)" on the side; accordion on mobile; breadcrumb via `state.from`.
- **Library:** view, status, platform and layout come from the URL `searchParams`; list is the default; grid with 2:3 cover, progress as a 3px rule at the bottom (jade at 100%).
- **Hall:** wall of stamps by year; `?tipo=platina|100`.
- **Plan:** editorial line; `YearStrip` with phase codes and a legend table; vertical list on mobile. With no plan, an empty state with "Create plan (Criar plano)". "Edit plan (Editar plano)" switches to edit mode (`src/components/plan/`, CSS `plano-editor.css`): inline forms, lists reorderable with arrows, phases in an accordion and a confirmation before deleting a phase.
- **Rankings:** tabs with four automatic lists (computed from achievements) and Essentials (Essenciais; community-curated, with attribution); numbered rows, games outside the library faded, "your note (sua nota)" under the row. **Sagas:** numbered phase sections, with curator attribution. **Community:** numbered spaces and grouped publications.
- **Almanac:** summary sentence, heat map; forces the light palette when printing.
- **Settings:** text-only vertical menu; 2 themes. **Login/Setup:** centered card with the brand and name.
- **States:** empty states in text (title + sentence + primary action); loading with gray-850 skeleton rows and no shimmer; error in `--zk-danger` with the cause and "Try again (Tentar de novo)". Icons only when they add meaning (platform, sort, close, external link), 16px, 1.5px stroke, `currentColor`.
- **Copy:** the UI supports pt-BR and English; direct, imperative on actions; level as "Level 45 · Master" (pt-BR: "Nível 45 · Mestre"); dates follow the locale (`20 Oct 2026` in text, `20 out 2026` in pt-BR) and `20.10.2026` in mono; decimal separator follows the locale (comma in pt-BR). 全クリ only in the brand and in About, never as a navigation label.

## Motion

140ms `ease-out` transitions (`--motion-fast`, `--motion-ease`) only on color, background, border, opacity and a light `transform` (≤2px); the navigation underline animates via `scaleX`. No continuous animation (pulse, shimmer, parallax, glow). The stamp may appear once when a game is completed (opacity and scale 1.04→1, 160ms). `prefers-reduced-motion` is respected.

## Do's and Don'ts

- Keep current calculations and features.
- **A single accent** (vermilion); extra color only for trophies and states.
- **No gradients, neon or glow**, not even in login backgrounds, placeholders or bars.
- **No rows of identical colored stat cards** (icon + number + "x% of total"): use an editorial line or a sheet. Do not show zeros without reason.
- Mono only in numeric table columns, section numbers and stamp dates; inline numbers use Inter `tabular-nums`.
- **Use existing primitives before creating styles:** `.btn` (+variants), `.accent-fill`, `.badge[data-tone]`, `.rule`/`.rule-strong`, `.micro`, `.num`, `.lede`, `.col-head`, `.row`, `.page`/`.page-head`, `.subtab`, `.segmented`, `.surface`, `SectionHead`, `Stamp`. New styles go in `src/styles/<page>.css`.
- Primary never with `bg-violet-600 text-white`; use `.btn-primary`/`.accent-fill`. Do not use `.stat-tile`/`.stat-strip`.
- Badges and states always with text, never color alone. Never remove the focus ring (`outline: 2px` violet-400).
- **Validate when implementing:** desktop (≥1280), tablet (768–1099), phone (<768); keyboard navigation (visible focus, order, skip-link); contrast (text ≥4.5:1, controls ≥3:1); **both themes** (`zenkuri` and `zenkuri-claro`); Almanac printing.

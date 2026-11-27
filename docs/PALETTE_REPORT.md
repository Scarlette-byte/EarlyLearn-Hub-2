# EarlyLearn Hub — Palette & Consistency Report

**Date:** 2026-11-27  
**Source of Truth:** `tailwind.config.js` + `src/index.css`  
**Regression Script:** `npm run check:palette` (`scripts/check-palette.mjs`)  
**Build Status:** `npm run build` — **PASS**

---

## 1. Source of Truth Tokens (`tailwind.config.js`)
- **Surfaces & Backgrounds:**
  - `ui-bg` (`#FAF5EC`) — warm cream page background
  - `ui-surface` (`#FFFFFF`) — card/modal surface
  - `ui-surface-subtle` (`#FFF8EE`) — subtle input/card tint
  - `ui-panel` (`#C8DBC6`) / `ui-panel-deep` (`#B5CEB2`) — sage-green sidebar
  - `dash-sage` (`#E7F0E6`), `dash-peach` (`#FDECE4`), `dash-cream` (`#FFF8EE`) — pastel card tints
- **Text & Borders:**
  - `ui-ink` (`#1E2D24`), `ui-ink-secondary` (`#4A5D52`), `ui-ink-muted` (`#677A6E`)
  - `ui-border` (`#E8E0D2`), `ui-border-strong` (`#D2C7B5`)
- **Actions & Accents:**
  - `dash-burnt` (`#D96B3B`) / `dash-burnt-hover` (`#C2592B`) — burnt-orange primary actions
  - `dash-forest` (`#1E3F2B`) / `dash-forest-deep` (`#163020`) — dark forest accents & icon buttons
  - `ui-focus` (`#D96B3B`) — focus-visible ring
- **Semantic Statuses:**
  - `status-ok` (`#1B663E`), `status-ok-bg` (`#ECFDF3`), `status-ok-border` (`#ABEFC6`)
  - `status-warn` (`#934F08`), `status-warn-bg` (`#FFFAEB`), `status-warn-border` (`#FEDF89`)
  - `status-error` (`#B42318`), `status-error-bg` (`#FEF3F2`), `status-error-border` (`#FECDCA`)

---

## 2. Shared Controls & Semantic Mapping
- **Buttons (`src/components/ui/Button.jsx`):** `primary`, `secondary`, `outline`, `ghost`, `danger`, `icon`
- **Hero Banner (`src/components/ui/HeroBanner.jsx`):** Peach-to-terracotta gradient (`from-[#F4A27E] via-[#E8845C] to-[#D66A43]`) with deep forest (`#1E3F2B`) primary pill button
- **Print Sheets (`TeacherReportSheet.jsx`):** Allow-listed for high-contrast print output (`@media print`)

---

## 3. Automated Palette Check (`npm run check:palette`)
- **Baseline scan:** `812` hardcoded hex occurrences across `src/` (excluding allow-listed SVG/print/token files: `index.css`, `PineappleLogo.jsx`, `Icons.jsx`, `Category3DBadges.jsx`, `KidIllustrations.jsx`, `TeacherReportSheet.jsx`, `src/assets/lottie/`).
- **Top remaining file:** `src/components/admin/ChildDevelopmentMonitoring.jsx` (inline hex status/card colors `#DCEBDD`, `#2E6B38`, `#FFF3D6`, `#8C6200`, `#FDE2E2`, `#9E2A2B`, `#FAF5EC`, `#E5DCC9`), which can be migrated to `status-*` and `ui-*` tokens incrementally.

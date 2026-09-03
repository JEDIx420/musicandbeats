# Phase 8 — Canonical Design System & CSS Mapping

This document details the architectural consolidation of all 34 historical stylesheets into a single, cohesive canonical stylesheet (`src/styles.css`). It records the legacy CSS inventory, canonical design tokens, selector ownership mappings, override eliminations, and the eventual retirement plan for legacy stylesheets.

---

### 1. Canonical Design System Tokens

All canonical UI styling is parameterized via CSS custom properties in `src/styles.css`:

```css
:root {
  /* Surfaces */
  --mb-bg: #07080a;
  --mb-surface-1: #101218;
  --mb-surface-2: #171a22;
  --mb-surface-3: #1f232d;
  --mb-surface-glass: rgba(16, 18, 24, 0.85);

  /* Lines & Borders */
  --mb-line: rgba(255, 255, 255, 0.08);
  --mb-line-strong: rgba(255, 255, 255, 0.16);

  /* Typography */
  --mb-text-primary: #f7f8fb;
  --mb-text-muted: #9299a8;
  --mb-text-faint: rgba(255, 255, 255, 0.40);

  /* Brand Accents */
  --mb-accent: #8b7cff;
  --mb-accent-hover: #9c8fff;
  --mb-accent-glow: rgba(139, 124, 255, 0.22);
  --mb-accent-cyan: #5fb7ff;
  --mb-accent-pink: #f47eac;

  /* State Colors */
  --mb-success: #58d59a;
  --mb-warning: #f5b85c;
  --mb-danger: #ff646e;

  /* Radii */
  --mb-radius-sm: 8px;
  --mb-radius-md: 12px;
  --mb-radius-lg: 18px;
  --mb-radius-full: 9999px;

  /* Shadows */
  --mb-shadow-card: 0 16px 48px rgba(0, 0, 0, 0.42);
  --mb-shadow-glow: 0 0 20px rgba(139, 124, 255, 0.35);

  /* Safe Area Insets */
  --mb-safe-top: env(safe-area-inset-top, 0px);
  --mb-safe-bottom: env(safe-area-inset-bottom, 0px);
  --mb-safe-left: env(safe-area-inset-left, 0px);
  --mb-safe-right: env(safe-area-inset-right, 0px);
}
```

---

### 2. Selector Ownership & Elimination of Version Numbers

All versioned class selectors (`.v34-`, `.v35-`, `.v38-`, `.v39-`, etc.) have been completely eliminated from the canonical stylesheet in favor of clean semantic selectors:

| Canonical UI Surface | Canonical Selector(s) | Replaces Legacy Selectors |
| :--- | :--- | :--- |
| **Application Shell** | `.mb-app-shell`, `.mb-navbar`, `.mb-brand-btn`, `.mb-nav-btn` | `.app-shell`, `.topbar`, `.brand-button`, `.nav-button` |
| **Smart Keys** | `.mb-smart-keys-view`, `.mb-chord-pad-grid`, `.mb-chord-pad` | `.chord-controls`, `.chord-pads`, `.v34-performance-pad`, `.v6-smart-toolbar` |
| **Keys Latch** | `.mb-btn-latch.active` | `.v18-latch-dock`, `.v18-latch-btn.active` |
| **Bass Surface** | `.mb-bass-view`, `.mb-bass-pad-grid`, `.mb-bass-pad` | `.v34-bass-pad`, `.v18-bass-dock` |
| **Guitar Surface** | `.mb-guitar-view`, `.mb-guitar-controls`, `.mb-guitar-meter-badge` | `.v6-guitar-rig`, `.v6-pedal`, `.v6-meter-fill` |
| **Lead Keyboard** | `.mb-lead-perf-shell`, `.mb-lead-keys-stage`, `.mb-key.white` | `.v38-keyboard`, `.v38-key`, `.v39-performance-shell` |
| **Performance Strips** | `.mb-perf-strip.pitch`, `.mb-perf-strip.mod` | `.v39-perf-strip.pitch`, `.v39-perf-strip.mod` |
| **Modular Drawers** | `.mb-drawer-bar`, `.mb-drawer-container`, `.mb-drawer-arp` | `.v22-drawer-bar`, `.v35-drawer`, `.v35-drawer-toggle` |
| **Record Looper** | `.mb-record-shell`, `.mb-record-transport`, `.mb-timeline-display` | `.v34-looper-screen`, `.v34-transport`, `.v34-clock` |
| **Track Strips** | `.mb-tracks-container`, `.mb-track-strip`, `.mb-btn-arm` | `.v34-tracks`, `.v34-track-strip`, `.v34-arm-btn` |
| **Help & Modals** | `.mb-help-modal-backdrop`, `.mb-help-card`, `.mb-help-tip` | `.help-center-modal`, `.v32-help-modal`, `.settings-dialog` |

---

### 3. Override Elimination & Cascade Simplification

1. **Specificity War Elimination**:
   - Legacy code used multi-level ID overrides (e.g. `#v34Workspace #v38Keyboard .v38-key`) and dozens of `!important` tags to enforce styling.
   - Canonical CSS uses single-class specificity with near-zero `!important` declarations (the only 3 `!important` occurrences are in the `@media (prefers-reduced-motion: reduce)` accessibility override).
2. **Keyframe Consolidation**:
   - Duplicate pulse keyframes (`@keyframes recPulse`, `@keyframes v34Pulse`, `@keyframes liveGlow`) are unified into a single coherent animation set.
3. **Touch Action Hardening**:
   - Explicit `touch-action: none` is applied directly to playable musical controls (`.mb-chord-pad`, `.mb-bass-pad`, `.mb-perf-strip`, `.mb-key.white`), ensuring reliable glides, bends, and chord triggers without preventing normal page scrolling.

---

### 4. Responsive Breakpoint Consolidation

The chaotic historical media queries (spanning 320px, 480px, 600px, 767px, 780px, 1024px, 1050px, 1180px) are consolidated into clean breakpoint tiers:
- **Mobile Portrait (max-width: 768px)**:
  - Smart Keys switches from 7-across to 4-column wrap.
  - Lead performance shell stacks strips vertically or collapses for phone ergonomics.
  - Record transport wraps cleanly without clipping time counters.
- **Tablet / Desktop (min-width: 769px)**:
  - Full side-by-side performance shell for Pitch and Modulation strips.
  - 7-pad horizontal chord grid matching standard musical octave flow.

---

### 5. Legacy CSS Retirement Inventory

The following 34 legacy CSS files currently active in the production build will be completely removed upon final production cutover:
`brand-v11.css`, `help.css`, `keyboard-ui.css`, `perf-debug.css`, `styles.css`, `v4.css`, `v5.css`, `v6.css`, `v6-patch.css`, `v7.css`, `v8.css`, `v9.css`, `v10.css`, `v12.css`, `v14.css`, `v15.css`, `v16.css`, `v17.css`, `v18.css`, `v19.css`, `v22.css`, `v23.css`, `v24.css`, `v25.css`, `v26.css`, `v27.css`, `v28.css`, `v29.css`, `v34-looper.css`, `v35.css`, `v36.css`, `v37.css`, `v38.css`, `v39.css`.

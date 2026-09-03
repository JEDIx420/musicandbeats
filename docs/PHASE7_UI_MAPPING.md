# Phase 7 — Canonical Application & UI Layer Mapping

This document details the consolidation of UI ownership and application interaction architecture, mapping the newly authored canonical modules (`src/app-core.js`, `src/play-ui.js`, `src/record-ui.js`, `src/help.js`) back to their historical origins, and analyzing the retirement path for legacy `MutationObserver` instances and global event listeners.

---

### 1. Canonical Surface Ownership Table

| Application Surface | Canonical Module | Responsibility |
| :--- | :--- | :--- |
| **Application Shell & Nav** | `src/app-core.js` | Top navbar, screen router (`home`, `play`, `record`), global panic, visibilitychange, touchmove hardening |
| **Play Workspace** | `src/play-ui.js` | Smart Keys, Bass, Guitar, Lead surfaces, Arp Lab, Groove Box, and Performance Rack drawers |
| **Record Setup & Session** | `src/record-ui.js` | Setup screen, Looper session transport, timeline bar/step animation, multi-track strips |
| **Help Center & Explain** | `src/help.js` | Comprehensive Help Center registry, "Explain Controls" mode, accessible modal dialogs |

---

### 2. Legacy UI Source Mapping

- **`app.js`**:
  - Legacy `renderHome()`, `renderPlay()`, `renderRecord()`, and `renderChordPads()` are superseded by modular `AppCore.navigateTo()`, `PlayUI.render()`, and `RecordUI.render()`.
- **`v6.js`**:
  - Legacy `v6SmartToolbar()` DOM injection hacks are superseded by the dedicated `PlayUI` Smart Keys toolbar.
  - Legacy `v6GuitarMarkup()` and `v6GuitarMeterRAF` are replaced by decoupled `GuitarRig` and `PlayUI.renderLane()`.
- **`keyboard-ui.js`**:
  - Legacy direct DOM node creation for 1–3 octaves is replaced by pure mathematical layout models in `SmartKeys.getKeyboardLayoutModel()` and `LeadInstrument.getKeyboardLayoutModel()`.
- **`help.js`**:
  - Legacy `HELP` dictionary and Explain Controls overlay are superseded by `src/help.js` with structured data attributes (`data-help="..."`).
- **`v34-looper.js`**:
  - Legacy `installLooper()` HTML injection and transport DOM bindings are consolidated into `RecordUI`.
- **`v35-ui.js`**:
  - Legacy drawer DOM mutators and style preset selectors are consolidated into `PlayUI.renderDrawers()`.
- **`v38.js` / `v38-stability.js`**:
  - Legacy keyboard DOM injection and `v38-stability` observer guards are replaced by `PlayUI.buildLeadHTML()` with native lifecycle ownership.
- **`v39-core.js` / `v39-lead.js`**:
  - Legacy capture-phase pointer event overrides and manual transposition select element injections are consolidated cleanly into `PlayUI` component controls.

---

### 3. Legacy MutationObserver Retirement Map

The consolidation baseline identified ~21 `MutationObserver` instances across legacy scripts. Upon final shadow cutover, **all 21 will become unnecessary** because the canonical UI renders through explicit component controllers rather than observing DOM mutations from older versions:

| Observer Location | Legacy File | Historical Purpose | Canonical Replacement | Needed After Cutover? |
| :--- | :--- | :--- | :--- | :--- |
| `v18.js` | `v18.js` | Injects `.v18-latch-dock` into toolbar | `PlayUI.buildSmartKeysHTML()` directly renders Latch button | **NO** |
| `v22.js` | `v22.js` | Injects modular drawer toggles | `PlayUI.render()` natively includes drawer toolbar | **NO** |
| `v24.js` | `v24.js` | Rebuilds pedalboard DOM | `PlayUI.buildGuitarHTML()` manages guitar rig DOM | **NO** |
| `v28.js` | `v28.js` | Inserts rotary knobs | `PlayUI.renderDrawers()` manages Performance Rack | **NO** |
| `v34-looper.js` | `v34-looper.js` | Watches screen changes to attach looper | `AppCore.navigateTo('record')` cleanly mounts `RecordUI` | **NO** |
| `v35-ui.js` | `v35-ui.js` | Re-syncs drawer expansion states | Component state `this.openDrawer` in `PlayUI` | **NO** |
| `v38-stability.js` | `v38-stability.js` | Locks Lead keyboard DOM against older scripts | Dedicated ownership of Lead stage in `PlayUI` | **NO** |
| `v39-core.js` | `v39-core.js` | Injects Keys/Bass transpose dropdowns | `PlayUI` natively renders transpose controls | **NO** |
| `v39-lead.js` | `v39-lead.js` | Injects pitch/mod performance strips | `PlayUI.buildLeadHTML()` natively renders strips | **NO** |

---

### 4. Global Event Listener Retirement Map

| Event Type | Legacy Multi-Registrations | Issues in Legacy Stack | Canonical Solution |
| :--- | :--- | :--- | :--- |
| `pointerdown` | `app.js`, `v18.js`, `v34-looper.js`, `v36.js`, `v39-core.js`, `v39-lead.js` | Multiple capture-phase interceptors fighting for chord/pad clicks | Single delegated listener inside `PlayUI` per instrument lane |
| `pointerup` / `pointercancel` | Registered across window/document in 7 patch files | Leaked pointer captures and dangling active note states | Centralized `playUI.unmount()` cleanly detaches all listeners |
| `touchmove` | `v4-fixes.js`, `v24.js` | Blind `e.preventDefault()` breaking normal page scrolling | `AppCore`: prevents default *only* on `.mb-key, .mb-chord-pad, .mb-perf-strip` |
| `visibilitychange` | `v9.js`, `v34-looper.js` | Conflicting background audio pause/resume behaviors | Centralized `AppCore.onVisibilityChange()` triggers clean `panic()` |

---

### 5. Phase 8 CSS Migration Inputs

The following table categorizes legacy CSS files and the canonical UI components they currently style:

| Legacy CSS File | Target Canonical UI Surface | Planned Phase 8 Action |
| :--- | :--- | :--- |
| `style.css` | Base typography, layout, CSS variables | Core foundation styling |
| `v4.css` | Expression sliders, knobs | Consolidate into `components/sliders.css` |
| `v6.css`, `v7.css` | Smart Keys pads, basic guitar rig | Consolidate into `instruments/smart-keys.css` |
| `v17.css`, `v18.css` | Performance rack, rotary knobs, latch docks | Consolidate into `components/rack.css` |
| `v22.css`, `v24.css` | Modular drawers, pedalboard | Consolidate into `components/drawers.css` |
| `v34.css`, `v35.css` | Looper screen, track strips, clock ring | Consolidate into `views/record.css` |
| `v38.css`, `v39.css` | Lead performance shell, pitch/mod strips, chord editor | Consolidate into `instruments/lead.css` |

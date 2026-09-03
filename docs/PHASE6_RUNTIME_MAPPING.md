# Phase 6 — Canonical Runtime Engines & Persistence Mapping

This document details the extraction mapping for the Phase 6 canonical runtime modules (`src/arp-engine.js`, `src/groove-box.js`, `src/recording.js`, `src/looper.js`, `src/projects.js`), mapping them to cumulative legacy files, detailing effective V39 behavior preserved, and enumerating legacy hacks made redundant upon cutover.

---

### 1. `src/arp-engine.js`
- **Legacy Sources**:
  - `v6.js` (base `v6StartArp`, `v6StopArp`, arp pattern directions)
  - `v7.js` (tempo locking, octave expansion)
  - `v15.js` (bass-specific ARP target routing)
  - `v17.js` (rich synth preset targeting, rapid note gates)
  - `v18.js` (latch integration)
  - `v19.js` (subdivisions down to 1/64)
  - `core-performance.js` / `core-performance-fixes.js` (look-ahead voice pool scheduling, pitch clearing, idle cleanup)
  - `v39-core.js` (Smart Keys custom chord interval synchronization and Keys/Bass transpose)
- **Effective Behavior Preserved**:
  - Web Audio look-ahead clock scheduling via `src/scheduler.js` (completely eliminating timer-recursion).
  - High-speed musical rates: 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/64.
  - Multi-octave expansion (1–4 octaves) across patterns: `up`, `down`, `upDown`, `random`, `chord`.
  - Smart Keys target synchronization respecting V39 custom chords, extensions, and Keys transpose.
  - Bass target synchronization respecting selected preset, register, and Bass transpose.
  - Allocation through canonical bounded 40-slot voice pool with pitch clearing on stop.
- **Legacy Hacks Made Redundant on Cutover**:
  - Recursive `setTimeout(tick, ...)` timers (`v6StartArp`).
  - Ad-hoc monkey patching of `v6StartArp` inside `core-performance-fixes.js`.

---

### 2. `src/groove-box.js`
- **Legacy Sources**:
  - `app.js` (base drum voices: Kick, Snare, Hi-Hat)
  - `v18.js` (16-step grid, pattern toggling)
  - `v34-looper.js` (Indian rhythmic styles `Keherwa` and `Dadra`, energy levels 1–5, procedural beat generator `loadBeat`)
  - `v35-core.js` (beat state persistence)
- **Effective Behavior Preserved**:
  - 16-step pattern programming across Kick, Snare, and Hat.
  - 10 genre styles: Worship, Pop, Rock, Funk, House, Trap, Reggaeton, Lo-Fi, Keherwa, Dadra.
  - Energy scaling (1–5) dynamically adapting ghost notes, rolls, and hats.
  - Pure Web Audio sound synthesis (punchy pitch-dropped kick, analog snare snap with filtered noise, metallic bandpass hat).
  - Clock synchronization driven strictly by `src/scheduler.js`.

---

### 3. `src/recording.js`
- **Legacy Sources**:
  - `app.js` / `recorder-worklet.js` (AudioWorklet `loop-capture` with exact sample/frame counting)
  - `v34-looper.js` / `fix/v34-capture-boundary` (sample-accurate start/end frame boundaries, count-in tracking, capture grace window)
  - `v35-core.js` (event filtering and boundary normalization)
- **Effective Behavior Preserved**:
  - Native AudioWorklet integration coordinating directly with untouched `recorder-worklet.js`.
  - Zero timer-based chunking; strict frame counting (`startFrame`, `frames`, `captured`).
  - Musical event recording (Keys & Bass) capturing note start, step quantization, duration in steps, and active preset.
  - Capture grace window ensuring notes held right up to the loop boundary are captured without truncation.

---

### 4. `src/looper.js`
- **Legacy Sources**:
  - `v34-looper.js` (mobile-first backing looper, 1/2/4/8 bar loops, event playback, active lane selection)
  - `v35-core.js` (track structure, event cleanup)
  - `v36.js` (lane release helpers)
  - `v37.js` (multi-track mixer: beats, keys, bass, lead)
  - `v39-lead.js` (backing track ducking during live solos)
  - `v39-core.js` (live event transposition on Keys/Bass transpose changes)
- **Effective Behavior Preserved**:
  - Exact loop calculations: bars (1, 2, 4, 8), BPM (40–220), 16 steps per bar.
  - Multi-track playback for Beats, Keys, Bass, and Lead.
  - Transport start/stop/reset driving canonical `src/scheduler.js`.
  - Musical event playback routing into canonical voice pool.
  - Transposition of existing track events when transpose changes.
  - Clean panic and voice clearing on transport stop.

---

### 5. `src/projects.js`
- **Legacy Sources**:
  - `app.js` (initial `musicandbeats-v3` IndexedDB persistence)
  - `v7.js` (project naming and export)
  - `v34-looper.js` (`musicandbeats:v34:looper` localStorage namespace)
  - `v35-core.js` (`musicandbeats:v35:projects`, `musicandbeats:v35:settings`, `musicandbeats:v35:autosave`)
  - `v37.js` (mixer level snapshots)
  - `v38.js` (lead settings snapshots)
  - `v39-core.js` (V39 project adapter saving custom chords, Keys/Bass transpose, and performance strips)
- **Effective Behavior Preserved**:
  - Canonical V39 Project Model representing all looper, instrument, beat, arp, and performance states.
  - Non-destructive Multi-Generation Compatibility Adapters:
    - Normalizes V3, V34, V35/V36, V37, V38, and V39 schemas in-memory.
    - Missing fields receive safe defaults; newer V39 fields survive round-trip saving.
  - Non-destructive persistence: maintains backward compatibility without clearing or corrupting older storage namespaces.

---

### 6. Comprehensive Consolidation Duplication Analysis

The following table summarizes all major application subsystems now fully represented in canonical ES modules under `src/`:

| Subsystem | Canonical Module | Primary Legacy Owner(s) | Status |
| :--- | :--- | :--- | :--- |
| **Audio Engine** | `src/audio-engine.js` | `app.js`, `v4-fixes.js`, `v13.js`, `v17.js`, `core-performance.js`, `core-performance-fixes.js` | Canonical Ready |
| **Scheduler** | `src/scheduler.js` | `core-performance.js`, `v6.js`, `v19.js` | Canonical Ready |
| **Effects & DSP** | `src/effects.js` | `v17.js`, `core-performance.js`, `v38.js`, `v39-lead.js` | Canonical Ready |
| **Smart Keys** | `src/instruments/smart-keys.js` | `app.js`, `v6.js`, `v14.js`, `v18.js`, `keyboard-ui.js`, `v34-looper.js`, `v39-core.js` | Canonical Ready |
| **Bass** | `src/instruments/bass.js` | `app.js`, `v4-fixes.js`, `v13.js`, `v15.js`, `v17.js`, `v18.js`, `v39-core.js` | Canonical Ready |
| **Guitar** | `src/instruments/guitar.js` | `v6.js`, `v6-patch.js`, `v10.js` | Canonical Ready |
| **Lead** | `src/instruments/lead.js` | `v37.js`, `v38.js`, `v38-stability.js`, `v39-core.js`, `v39-lead.js` | Canonical Ready |
| **Arpeggiator** | `src/arp-engine.js` | `v6.js`, `v7.js`, `v15.js`, `v17.js`, `v19.js`, `core-performance.js`, `v39-core.js` | Canonical Ready |
| **Groove Box** | `src/groove-box.js` | `app.js`, `v18.js`, `v34-looper.js`, `v35-core.js` | Canonical Ready |
| **Recording** | `src/recording.js` | `app.js`, `recorder-worklet.js`, `v34-looper.js`, `v35-core.js` | Canonical Ready |
| **Live Looper** | `src/looper.js` | `v34-looper.js`, `v35-core.js`, `v36.js`, `v37.js`, `v39-core.js` | Canonical Ready |
| **Projects** | `src/projects.js` | `app.js`, `v7.js`, `v34-looper.js`, `v35-core.js`, `v37.js`, `v38.js`, `v39-core.js` | Canonical Ready |

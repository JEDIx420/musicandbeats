# Phase 4 — Canonical Foundation Mapping

This document details the exact extraction mapping for the Phase 4 canonical foundation modules (`src/state.js`, `src/audio-engine.js`, `src/scheduler.js`, `src/effects.js`), recording the cumulative legacy sources and the effective V39 behavior preserved.

---

### 1. `src/state.js`
- **Legacy Sources**:
  - `app.js` (`NOTES`, `FLAT`, `CHORD_FLAVORS`, base `SOUND_PRESETS`, `BEAT_PRESETS`, `session` structure)
  - `v6.js` (`V6_CHORD_TYPES`, `V6_CHORD_INTERVALS`)
  - `v17.js` (`V17_KEY_LIBRARY`, `V17_BASS_LIBRARY`, extended sound presets with categories & detuning)
  - `v34-looper.js` (Indian synth presets `Harmonium`, `Tanpura Drone`, `Bansuri Air`, `Sitar Pluck`, beat styles `Keherwa`, `Dadra`)
  - `v37.js` (Backing mixer channels `beats`, `keys`, `bass`, `lead`, lead synth presets `Bansuri Lead`, `Sitar Lead`, `Fusion Lead`, `Glass Lead`)
  - `v39-core.js` (V39 chord intervals `V39_CHORD_INTERVALS`, Keys/Bass transpose values, `v39` settings namespaces)
- **Effective Behavior Preserved**:
  - Centralized immutable musical constants and 12-chromatic note mapping.
  - Complete 30+ synth sound library across acoustic, electric, EDM, sub, and ethnic instruments.
  - 10 drum groove presets spanning pop/rock/urban and Indian rhythmic traditions.
  - Storage key namespace registry for IndexedDB and localStorage.
  - Pure calculation helpers (`midiToFreq`, `noteMidi`, `midiLabel`, `barSeconds`, `clamp`).

---

### 2. `src/audio-engine.js`
- **Legacy Sources**:
  - `app.js` (`buildAudio`, `ctx`, `master`, `compressor`, `synthBus`, base `startVoice`, `panic`)
  - `v4-fixes.js` (Expression scaling: `velocity`, `sustain`, `tone`, `space`)
  - `v13.js` (`voice.hardStop()` with 6ms linear ramp to prevent hanging notes)
  - `v17.js` (Detune cents, multi-oscillator arrays, lowpass filter envelope with `v17.filterEnv`)
  - `core-performance.js` (`MB_CORE_V2`: 40-slot bounded voice pool, voice reuse, eviction / voice stealing, natural vs pooled envelope scaling)
  - `core-performance-fixes.js` (`clearFuturePitch`, `disposePool`, 2.6s idle timer cleanup)
- **Effective Behavior Preserved**:
  - Idempotent `AudioContext` resumption and interactive latency graph.
  - Canonical `startVoice()` reproducing detuned multi-oscillators, filter attack/decay envelope, and hardStop capability.
  - Bounded 40-slot voice pool for high-rate ARP playback avoiding oscillator memory leaks.
  - Unified `panic()` stopping pointer voices, latched chord voices, and flushing pending voice pool schedules.

---

### 3. `src/scheduler.js`
- **Legacy Sources**:
  - `core-performance.js` (Look-ahead Web Audio clock scheduler, 25ms interval waking, 100ms horizon)
  - `v6.js` / `v7.js` / `v17.js` / `v19.js` (Subdivision mathematics: 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/64)
- **Effective Behavior Preserved**:
  - Pure look-ahead timing primitive tied to `AudioContext.currentTime`.
  - Elimination of timer recursion and UI main-thread event drift.
  - Support for ultra-fast 1/64 subdivisions without drift or scheduler stalling.
  - Clean observer subscription pattern (`onStep(id, callback)`) and requestAnimationFrame UI synchronization queue.

---

### 4. `src/effects.js`
- **Legacy Sources**:
  - `v17.js` (`v17EnsureSynthRack`, `v17ApplyFx`, `V17_FX_BOARDS`, `v17DriveCurve`)
  - `core-performance.js` (Drive curve caching)
  - `v38.js` (Deep FX presets: 20 boards from Dry to Cathedral and Ping Pong)
  - `v39-lead.js` (Complete V39 Lead FX Graph: waveshaper saturation, 4 modulation modes, stereo delay with pan, convolution reverb, highpass, peaking presence EQ, bus compressor, and dynamic backing mixer level scaling)
- **Effective Behavior Preserved**:
  - Cached tanh distortion curves and algebraic saturation curves.
  - M&B Performance Rack with 7 classic boards.
  - Lead Effects Graph with 20 deep FX presets including Stereo Panner, LFO modulation, Highpass/Peaking presence shaping, and backing mixer gain coupling.
  - Clean AudioNode disconnection and LFO stopping during board switches.

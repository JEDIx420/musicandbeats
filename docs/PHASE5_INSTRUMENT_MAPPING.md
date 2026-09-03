# Phase 5 — Canonical Instrument Mapping

This document details the exact extraction mapping for the Phase 5 canonical instrument modules (`src/instruments/smart-keys.js`, `src/instruments/bass.js`, `src/instruments/guitar.js`, `src/instruments/lead.js`), recording the cumulative legacy sources, effective V39 behavior preserved, and legacy hacks/overrides that will become removable upon final cutover.

---

### 1. `src/instruments/smart-keys.js`
- **Legacy Sources**:
  - `app.js` (base `chordData`, diatonic degree generation, voicings `close`, `open`, `wide`)
  - `v6.js` (custom chord type intervals, `v6StartSmartChord`, pad labeling)
  - `v18.js` (global LATCH switch integration with Smart Keys lane)
  - `keyboard-ui.js` (explicit white/black piano key proportional geometry for 1–3 displayed octaves)
  - `v39-core.js` (exhaustive 33+ chord types, custom semitone interval string parser `custom(s)`, Keys transpose ±12 st, and custom chord latch playback fix)
- **Effective Behavior Preserved**:
  - Diatonic scale chords generation across all 12 musical keys.
  - 7 independently customizable chord slots with roots and 33+ chord extensions or custom semitone offsets (e.g. `0,4,7,10,14`).
  - Keys Transpose (`-12..+12 st`) affecting live pad MIDI calculation and existing looper events.
  - V39 exclusive lane latch: next pad replaces held, re-tapping active pad releases it, and custom chords retain their exact custom MIDI notes without reverting to default triads.
  - Clean separation of musical note calculation from DOM keyboard geometry (supporting 1, 2, or 3 displayed octaves).
- **Legacy Hacks Made Redundant on Cutover**:
  - `v6SmartToolbar` DOM insertion hacks.
  - Double-tap latch timers (`v14.js`).
  - `v39-core.js` `document.addEventListener('pointerdown', ..., true)` capture-phase monkey-patches overriding `v36.js` and `v34-looper.js`.

---

### 2. `src/instruments/bass.js`
- **Legacy Sources**:
  - `app.js` / `v4-fixes.js` (base synth presets, bass octave rendering)
  - `v13.js` (`voice.hardStop()` preventing hanging low-frequency notes on transport stop)
  - `v15.js` (bass-specific ARP target routing)
  - `v17.js` (expanded bass library: `Reese Bass`, `Acid Bass`, `FM House Bass`, `Future Growl`)
  - `v18.js` (dedicated Bass LATCH mode)
  - `v39-core.js` (Bass transpose ±12 st and pad MIDI updates)
- **Effective Behavior Preserved**:
  - Full 7-preset bass sound library.
  - Dedicated Bass LATCH mode with exclusive single-note hold.
  - `hardStopAll()` ensuring instant, clean note cutoff when playback stops or lanes switch.
  - Bass Transpose (`-12..+12 st`) recalculating live pad MIDI pitch.
- **Legacy Hacks Made Redundant on Cutover**:
  - MutationObservers injecting `.v18-latch-dock` into the bass toolbar.
  - Repeated `hardStop` monkey-patches over `stopSession`.

---

### 3. `src/instruments/guitar.js`
- **Legacy Sources**:
  - `v6.js` (audio input streaming, `v6DriveCurve`, virtual amp DSP graph, 6 guitar presets, pedalboard toggle logic)
  - `v6-patch.js` (guitar meter cleanup, audio input event delegation)
  - `v10.js` (input trim calibration and normalization)
- **Effective Behavior Preserved**:
  - Real hardware audio input streaming with explicit device selection (`audioinput`).
  - Signal level meter tracking RMS, dBV, peak clipping, and signal presence.
  - 6 virtual amp patches: Clean Glass, Warm Combo, Edge Crunch, Arena Lead, Ambient Swell, Worship Shimmer.
  - Full pedalboard DSP chain: Highpass (68Hz) -> WaveShaper Drive -> Tone Filter -> Compressor -> Dry/Chorus/Delay/Convolver Reverb -> Monitor Bus -> Master Output.
  - Robust teardown disconnecting MediaStreams and stopping audio tracks.
- **Legacy Hacks Made Redundant on Cutover**:
  - Global `v6GuitarMeterRAF` loops surviving hidden tabs.
  - DOM-based pedal state parsing and inline HTML string rebuilds.

---

### 4. `src/instruments/lead.js`
- **Legacy Sources**:
  - `v37.js` (lead lane integration and backing mixer scaling)
  - `v38.js` (chromatic piano/keytar keyboard, GeneralUser GS SoundFont loader, nearest-zone fallback, deep FX graph)
  - `v38-stability.js` (locking Lead ownership against legacy UI observers)
  - `v39-core.js` (44 SoundFont instrument sample catalog, voice group classifications)
  - `v39-lead.js` (portamento glide 0–300ms, spring-to-center pitch bend strip, modulation strip driving 5.2Hz vibrato, async pointer cancellation, backing track ducking)
- **Effective Behavior Preserved**:
  - Chromatic performance keyboard with 1–3 displayed octaves in Piano or Keytar layouts.
  - 44 GeneralUser GS SoundFont sample presets categorized into 7 musical families, with automatic fallback to rich synth leads.
  - Portamento Glide (`0–300ms`) with smooth retuning during key drag gestures.
  - Continuous Pitch Bend Strip (`±2, ±7, ±12 st`) with spring-to-center physics.
  - Modulation Strip (`0–100%`) driving 5.2Hz LFO vibrato.
  - Backing track ducking gently attenuating looper playback while playing solos.
  - Asynchronous pointer cancellation: immediate cancellation if a pointer is released before an async sample buffer resolves, preventing orphan voices.
- **Legacy Hacks Made Redundant on Cutover**:
  - `v38-stability.js` observer warfare against older UI scripts.
  - Ad-hoc global `window.MB_V38_LEAD_ACTIVE` flags.
  - Redundant duplicate sample loaders across V38 and V39.

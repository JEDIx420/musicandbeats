# Music & Beats — Global Symbol Ownership & Override Chains (Reconciled to V39)

This document maps the evolution of key global functions, state containers, and event loops across the historical patch stack up through V39, establishing what is authoritative and where it belongs in the consolidated architecture.

---

## 1. Major Function Override Chains

### `renderPlayInstrument` & Workspace Layout
- **Chain**:
  1. `app.js`: Base implementation (switches `#playChordControls`, `#playKeyboard`, calls `renderChordPads` / `renderKeyboard`).
  2. `v5-fixes.js`: Adds track volume synchronization.
  3. `v6.js`: Adds guitar tab, hides Smart Keys controls when guitar selected.
  4. `v15.js`: Adds bass ARP integration and bass-specific preset selectors.
  5. `v16.js`: Adds UI resize guarding.
  6. `v17.js`: Injects V17 Performance Rack and knob strips into instrument panel.
  7. `v18.js`: Injects V18 global LATCH switch and wires latch state.
  8. `v24.js`: Wraps inside `v24BuildPlayStack`, splitting workspace into modular drawers.
  9. `keyboard-ui.js`: Wraps to render configured 1–3 displayed octaves on the Smart Keys keyboard.
  10. `v39-core.js` / `v39-lead.js`: Injects Transpose controls (Keys & Bass), Chord Editor, and Pitch/Mod performance strips.
- **Authoritative V39 Behavior**:
  Modular drawer layout with Smart Keys / Bass / Guitar / Lead tabs, hardware knobs, LATCH button, 1–3 displayed octaves, Transpose controls, chord editor, and Pitch/Mod strips.
- **Canonical Owner**: `src/play-ui.js` & `src/instruments/`

---

### `renderKeyboard`
- **Chain**:
  1. `app.js`: Base function rendering white and black keys with basic CSS positioning.
  2. `v5-fixes.js`: Fixes pointer event capturing on mobile.
  3. `keyboard-ui.js`: Completely overrides `renderKeyboard` for `#playKeyboard` when `playInstrument === 'chords'`, applying exact mathematical white key counts, black key widths (`(100/whiteCount)*0.62`), and 1–3 displayed octaves based on user setting.
- **Authoritative V39 Behavior**:
  Strict proportional black/white key geometry supporting 1, 2, or 3 displayed octaves without layout breaking.
- **Canonical Owner**: `src/instruments/smart-keys.js`

---

### `startVoice(midi, preset, velocity)`
- **Chain**:
  1. `app.js`: Basic 3-oscillator synth with fixed envelope and filter.
  2. `v4-fixes.js`: Adds expression controls scaling (velocity, sustain, tone, space).
  3. `v13.js`: Adds `voice.hardStop()` method to instantly kill notes with 6ms linear ramp to prevent hanging notes.
  4. `v17.js`: Expands `SOUND_PRESETS` with rich multi-oscillator definitions, detune cents, category metadata, and routes through `v17SynthRack`.
  5. `core-performance.js`: Intercepts ARP note generation by routing through `MB_CORE_V2.pool` (40 bounded voice slots) with voice stealing, cached drive curves, and throttled UI updates. Manual keyboard notes continue to use `v17`'s enriched `startVoice`.
- **Authoritative V39 Behavior**:
  High-fidelity multi-oscillator synth engine with detuning, filter envelopes, expression scaling, and `hardStop()` capability, paired with a bounded voice pool for fast ARP playback.
- **Canonical Owner**: `src/audio-engine.js`

---

### `primeAudio()`
- **Chain**:
  1. `app.js`: Calls `buildAudio()`, resumes suspended context, updates `#engineBadge`.
  2. `core-performance.js`: Wraps `primeAudio()` to make it completely idempotent and removes redundant DOM manipulation when audio is already running.
- **Authoritative V39 Behavior**:
  Idempotent resume check without redundant DOM writes on the audio hot path.
- **Canonical Owner**: `src/audio-engine.js`

---

### `getLayerBus(layer)`
- **Chain**:
  1. `app.js`: Returns `inputGain` for input, `drumBus` for beats, `synthBus` for keys.
  2. `v6.js`: Extends to return `v6GuitarNodes.output` for guitar.
  3. `v10.js`: Adds normalized mic input gain staging.
  4. `v17-fixes.js`: Cleans up routing to prevent duplicate connections to `master`.
- **Authoritative V39 Behavior**:
  Returns dedicated bus per layer source (input, guitar, beats, chords, bass, lead).
- **Canonical Owner**: `src/recording.js`

---

### ARP Engine (`v6StartArp`, `v6ArpTick`, `v6PaintArp`)
- **Chain**:
  1. `v6.js`: Basic timer-based arpeggiator using `setTimeout` recursion (drifts under load).
  2. `v7.js`: Ascending octave logic and waveform canvas painter.
  3. `v15.js`: Extends ARP to target Bass.
  4. `v17.js`: Adds EDM modes, subdivisions, velocity patterns, and ratchets.
  5. `v18.js`: Replaces ARP latch with explicit global LATCH.
  6. `v19.js`: Adds 1/32 and 1/64 rates.
  7. `core-performance.js`: Completely supersedes recursive `setTimeout` scheduling with `MB_CORE_V2` look-ahead scheduler tied to `AudioContext.currentTime`. Ratchets, swing, and motion are calculated directly on the Web Audio timeline.
- **Authoritative V39 Behavior**:
  Look-ahead Web Audio clock scheduler with 1/4 to 1/64 rates, ratchet repeats, swing, motion, rhythm masks, and low-drift performance.
- **Canonical Owner**: `src/arp-engine.js` & `src/scheduler.js`

---

### Smart Keys & Chord Pad Engine (V39 Evolution)
- **Chain**:
  1. `app.js`: Basic diatonic 7 triad/7th chords generated from Key.
  2. `v6.js`: Editable chords, chord suffixes, voicing (close/open/wide).
  3. `v18.js`: Global latch button and chord hold logic.
  4. `v34-looper.js`: Looper event recording of chord pads.
  5. `v36.js`: Decorates pads with latched CSS states.
  6. `v39-core.js`:
     - Keys Transpose (±12 semitones) shifting all recorded and live chord pad midis.
     - Interactive Chord Editor: 7 independent slots, selecting root, preset chord types (Major, Minor, 7th, Maj7, m7, 9th, Sus2, Sus4, etc.), or `Custom` with arbitrary semitone offsets (e.g. `0,4,7,10,14`).
     - Latch playback ownership fix: `v39-core.js` intercepts pointer events on chord pads so custom edited chords play and latch with their full custom MIDI notes (`dataset.v39Midis`), rather than reverting to legacy hardcoded chords.
- **Authoritative V39 Behavior**:
  Full 7-pad customized chord bank with arbitrary interval support, Keys transpose, and custom chord latch playback.
- **Canonical Owner**: `src/instruments/smart-keys.js`

---

### Bass Instrument & Transpose (V39 Evolution)
- **Chain**:
  1. `app.js` / `v4-fixes.js`: Sub Bass patch and basic bass octave rendering.
  2. `v13.js`: Bass `hardStop()` note clearing.
  3. `v17.js`: Rich bass library (Reese Bass, Acid Bass, FM House Bass, Future Growl).
  4. `v18.js`: Dedicated Bass LATCH mode.
  5. `v39-core.js`: Bass Transpose (±12 semitones) that recalculates both live pad MIDI values and transposes all recorded looper bass events cleanly.
- **Authoritative V39 Behavior**:
  Synthesized multi-oscillator bass patches with Bass LATCH, hardStop(), and ±12 st transpose.
- **Canonical Owner**: `src/instruments/bass.js`

---

### Lead Instrument & Pitch/Mod/Glide (V39 Evolution)
- **Chain**:
  1. `v37.js`: Initial Lead lane with pentatonic scale mapping.
  2. `v38.js`: Chromatic piano/keytar Lead keyboard with 1–3 displayed octaves, SoundFont sample loading (`0000_GeneralUserGS_sf2_file.js`, etc.), synth fallback, and 20 deep FX presets.
  3. `v39-lead.js`:
     - Portamento Glide (`0–300ms`, toggleable) across pointer glide gestures.
     - Hardware Pitch Bend Strip (±2, ±7, ±12 st) with spring-to-center physics.
     - Hardware Modulation Strip (0–100%) driving 5.2Hz LFO vibrato depth.
     - Expanded Western GeneralUser GS sample catalog categorized by voice groups (Pianos, Organs, Guitars, Reeds, Strings, Brass, Synths, Ethnic).
     - Live FX output gain scaled dynamically by V37 backing mixer.
- **Authoritative V39 Behavior**:
  Chromatic Lead with SoundFont sample loader, synth fallback, pitch strip, mod strip, portamento glide, and deep FX graph.
- **Canonical Owner**: `src/instruments/lead.js` & `src/effects.js`

---

### Project Persistence (`saveProject`, `restoreProject`)
- **Chain**:
  1. `app.js`: Saves single state to IndexedDB `musicandbeats-v3` under key `'last'`.
  2. `v34-looper.js`: Saves event-based looper tracks to `musicandbeats:v34:looper`.
  3. `v35-core.js` / `v35-ui.js`: Implements named multi-project management in `musicandbeats:v35:projects` with autosave, snapshots, and style presets.
  4. `v37.js`: Hooks project save/load to include multi-track mix and lead state.
  5. `v38.js`: Hooks project save/load to include Lead layout, voice, octaves, and deep FX settings.
  6. `v39-core.js`: Hooks project save/load to include V39 snapshot (`transpose`, `chords`, `chordsCustomized`, `chordKey`, `slide`, `glideMs`, `pitchRange`, `mod`, `leadVoice`).
- **Authoritative V39 Behavior**:
  Unified project storage preserving all workstation parameters, looper tracks, Lead configuration, V39 transpose and custom chords, and backwards compatibility with existing IndexedDB / localStorage data.
- **Canonical Owner**: `src/projects.js`

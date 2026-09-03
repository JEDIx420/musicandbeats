# Music & Beats — Global Symbol Ownership & Override Chains

This document maps the evolution of key global functions, state containers, and event loops across the historical patch stack, establishing what is authoritative in V38 and where it belongs in the consolidated architecture.

---

## 1. Major Function Override Chains

### `renderPlayInstrument`
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
- **Authoritative V38 Behavior**:
  Modular drawer layout with Smart Keys / Bass / Guitar / Lead tabs, hardware knobs, LATCH button, and 1–3 displayed octaves.
- **Canonical Owner**: `src/play-ui.js` & `src/instruments/`

---

### `renderKeyboard`
- **Chain**:
  1. `app.js`: Base function rendering white and black keys with basic CSS positioning.
  2. `v5-fixes.js`: Fixes pointer event capturing on mobile.
  3. `keyboard-ui.js`: Completely overrides `renderKeyboard` for `#playKeyboard` when `playInstrument === 'chords'`, applying exact mathematical white key counts, black key widths (`(100/whiteCount)*0.62`), and 1–3 displayed octaves based on user setting.
- **Authoritative V38 Behavior**:
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
- **Authoritative V38 Behavior**:
  High-fidelity multi-oscillator synth engine with detuning, filter envelopes, expression scaling, and `hardStop()` capability, paired with a bounded voice pool for fast ARP playback.
- **Canonical Owner**: `src/audio-engine.js`

---

### `primeAudio()`
- **Chain**:
  1. `app.js`: Calls `buildAudio()`, resumes suspended context, updates `#engineBadge`.
  2. `core-performance.js`: Wraps `primeAudio()` to make it completely idempotent and removes redundant DOM manipulation when audio is already running.
- **Authoritative V38 Behavior**:
  Idempotent resume check without redundant DOM writes on the audio hot path.
- **Canonical Owner**: `src/audio-engine.js`

---

### `getLayerBus(layer)`
- **Chain**:
  1. `app.js`: Returns `inputGain` for input, `drumBus` for beats, `synthBus` for keys.
  2. `v6.js`: Extends to return `v6GuitarNodes.output` for guitar.
  3. `v10.js`: Adds normalized mic input gain staging.
  4. `v17-fixes.js`: Cleans up routing to prevent duplicate connections to `master`.
- **Authoritative V38 Behavior**:
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
- **Authoritative V38 Behavior**:
  Look-ahead Web Audio clock scheduler with 1/4 to 1/64 rates, ratchet repeats, swing, motion, rhythm masks, and low-drift performance.
- **Canonical Owner**: `src/arp-engine.js` & `src/scheduler.js`

---

### Groove Box (`loadBeat`, `renderSequencer`, `startScheduler`)
- **Chain**:
  1. `app.js`: 8 basic presets (Worship, Pop, Rock, Funk, House, Trap, Reggaeton, Lo-Fi) and 16-step sequencer with basic procedural variation.
  2. `v18.js`: Introduces hardware Groove Box deck with Density, Sync, Swing, Humanize, Punch, and Fill controls, generating varied patterns adhering to style guidelines.
  3. `v34-looper.js`: Adds Indian rhythm styles (Keherwa, Dadra) and event-based drum loop playback.
- **Authoritative V38 Behavior**:
  Full 10-genre Groove Box with 16-step manual editing, procedural generation parameters, and sample-accurate playback.
- **Canonical Owner**: `src/groove-box.js`

---

### Lead Instrument & Sample Voices
- **Chain**:
  1. `v37.js`: Initial Lead lane with scale constraints (pentatonic / major / minor) and synth presets.
  2. `v38.js`: Completely overhauls Lead into a chromatic piano/keytar keyboard with 1–3 displayed octaves, SoundFont / GeneralUser GS sample loading (`0000_GeneralUserGS_sf2_file.js`, etc.), synth fallback, and 20 deep FX presets.
  3. `v38-stability.js`: Locks Lead ownership to prevent legacy observers from reverting the Lead UI card.
- **Authoritative V38 Behavior**:
  V38 true chromatic piano/keytar Lead with sample loader and deep FX rack.
- **Canonical Owner**: `src/instruments/lead.js`

---

### Project Persistence (`saveProject`, `restoreProject`)
- **Chain**:
  1. `app.js`: Saves single state to IndexedDB `musicandbeats-v3` under key `'last'`.
  2. `v34-looper.js`: Saves event-based looper tracks to `musicandbeats:v34:looper`.
  3. `v35-core.js` / `v35-ui.js`: Implements named multi-project management in `musicandbeats:v35:projects` with autosave, snapshots, and style presets.
  4. `v37.js`: Hooks project save/load to include multi-track mix and lead state.
  5. `v38.js`: Hooks project save/load to include Lead layout, voice, octaves, and deep FX settings.
- **Authoritative V38 Behavior**:
  Unified project storage preserving all workstation parameters, looper tracks, Lead configuration, and backwards compatibility with existing IndexedDB / localStorage data.
- **Canonical Owner**: `src/projects.js`

---

## 2. Global Observers, Timers & Event Listeners

### MutationObservers (Current Count: 21)
Historical versions frequently used `new MutationObserver(...)` on `document.body` to react when DOM was rebuilt:
- `v9.js`: Scans expression controls on DOM mutation.
- `v12.js`: Re-applies touch guards on DOM mutation.
- `v14.js`: Re-binds latch buttons.
- `v19.js`: Re-attaches collapsible rack toggles.
- `v23.js`: Re-attaches latch listeners.
- `v24.js` / `v25.js`: Re-attaches drawer headers.
- `v35-ui.js`: Injects project button into topbar.
- `v38-stability.js`: Enforces V38 Lead card binding against older observers.

**Consolidation Plan**: Replace DOM MutationObservers with explicit lifecycle hooks inside canonical modules. MutationObservers should only remain if needed for third-party or browser-specific resilience.

### Background Timers & Loops
- **Look-Ahead Scheduler (`core-performance.js`)**: Runs `setInterval` every 25ms to schedule audio notes ahead by 100ms. **(KEEP — Authoritative)**
- **ARP Visualizer Loop**: Runs via `requestAnimationFrame` only when ARP is active. **(KEEP — Optimized)**
- **Guitar Input Meter**: Runs via `requestAnimationFrame` when guitar monitoring is active. **(KEEP)**
- **Legacy Timers (`v6.js`)**: Recursive `setTimeout` ARP loops. **(SUPERSEDED / ELIMINATED)**

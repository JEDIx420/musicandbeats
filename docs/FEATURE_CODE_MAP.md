# Music & Beats — Feature to Code Map

This document cross-references every required product feature to its existing implementation locations and its destination canonical module.

---

### FEATURE: Application Shell, Home Screen & Navigation
- **State**: `currentScreen`, `panic()`
- **Functions**: `setScreen()`, `setupNavigation()`, `v8InstallBootGate()`
- **DOM**: `#homeScreen`, `#homeBtn`, `#enterPlay`, `#enterRecord`, `#engineBadge`
- **CSS**: `styles.css`, `v8.css`
- **Current Owner**: `app.js`, `v8.js`
- **Canonical Owner**: `src/app-core.js`, `src/state.js`

---

### FEATURE: Smart Keys & Latch
- **State**: `v6PlaySmartKeys`, `v6PlaySmartKeyPreset`, `V18_LATCH.smart`, `chordVoices`
- **Functions**: `chordData()`, `chordIntervals()`, `voiced()`, `v6DefaultSmartKeys()`, `v6ChordNotes()`, `v18SetLatch()`, `v18ReleaseSmartHeld()`
- **DOM**: `#playChords`, `.chord-pad`, `.v18-latch-switch`
- **CSS**: `styles.css`, `v6.css`, `v18.css`, `v23.css`
- **Persistence**: `musicandbeats:v18:latch:smart`, project snapshot
- **Current Owner**: `app.js`, `v6.js`, `v18.js`, `v23.js`
- **Canonical Owner**: `src/instruments/smart-keys.js`

---

### FEATURE: Chromatic Keyboard & Displayed Octaves (Smart Keys)
- **State**: `STORAGE = 'musicandbeats:v33:displayed-octaves'`, `readOctaves()`, `writeOctaves()`
- **Functions**: `renderSmartKeyboard()`, `bindKeyboard()`, `installControl()`
- **DOM**: `#playKeyboard`, `.piano-key`, `#playDisplayOctaves`
- **CSS**: `keyboard-ui.css`, `styles.css`
- **Persistence**: `musicandbeats:v33:displayed-octaves`
- **Current Owner**: `app.js`, `keyboard-ui.js`
- **Canonical Owner**: `src/instruments/smart-keys.js`

---

### FEATURE: Lead Instrument (Piano / Keytar / Samples / Deep FX)
- **State**: `state.layout`, `state.voice`, `state.startOctave`, `state.displayOctaves`, `state.fxPreset`, `state.fx`, `SAMPLE_VOICES`
- **Functions**: `buildFX()`, `loadSampleVoice()`, `playNote()`, `stopNote()`, `renderLead()`, `decorate()`
- **DOM**: `#v37LeadTrack`, `.v38-lead-shell`, `.v38-key`
- **CSS**: `v38.css`, `v37.css`
- **Persistence**: `musicandbeats:v38:settings`, `musicandbeats:v35:projects`
- **Current Owner**: `v38.js`, `v38-stability.js`, `v37.js`
- **Canonical Owner**: `src/instruments/lead.js`

---

### FEATURE: Bass Synth & Bass Latch
- **State**: `V17_BASS_LIBRARY`, `V18_LATCH.bass`, `v18BassHeld`
- **Functions**: `renderPlayInstrument()`, `v18SetLatch('bass')`, `v18ReleaseBassHeld()`
- **DOM**: `#playKeyboard`, `[data-v18-latch="bass"]`
- **CSS**: `v4.css`, `v17.css`, `v18.css`
- **Persistence**: `musicandbeats:v18:latch:bass`, project snapshot
- **Current Owner**: `app.js`, `v4-fixes.js`, `v13.js`, `v17.js`, `v18.js`
- **Canonical Owner**: `src/instruments/bass.js`

---

### FEATURE: Guitar Rig & Pedals
- **State**: `V6_GUITAR_PATCHES`, `v6GuitarState`, `v6GuitarNodes`, `v6GuitarStream`
- **Functions**: `v6SetupGuitarInput()`, `v6BuildGuitarGraph()`, `v6ApplyGuitarPatch()`, `v6RenderGuitarDeck()`
- **DOM**: `#playScreen [data-instrument="guitar"]`, `.v6-guitar-rig`, `.v6-pedal`
- **CSS**: `v6.css`, `v6-patch.css`
- **Persistence**: Session / project state
- **Current Owner**: `v6.js`, `v6-patch.js`
- **Canonical Owner**: `src/instruments/guitar.js`

---

### FEATURE: Groove Box (16-Step Beat Sequencer)
- **State**: `BEAT_PRESETS`, `playPattern`, `V18_PLAY_BEAT` (density, sync, swing, human, punch, fill, kit)
- **Functions**: `loadBeat()`, `clearPattern()`, `renderSequencer()`, `v18ApplyGroove()`, `v18StepSound()`
- **DOM**: `#playSequencer`, `.step`, `.beat-options`, `.v18-groove-deck`
- **CSS**: `styles.css`, `v18.css`
- **Persistence**: `musicandbeats:v18:playbeat`, project snapshot
- **Current Owner**: `app.js`, `v18.js`, `v34-looper.js`
- **Canonical Owner**: `src/groove-box.js`

---

### FEATURE: Arp Lab (1/4 to 1/64, Look-Ahead Scheduler, Ratchet, Motion)
- **State**: `v6Arp`, `V17_PLAY_ARP`, `MB_CORE_V2` (pool of 40 voices, look-ahead clock)
- **Functions**: `v6StartArp()`, `v15HardStopArp()`, `coreScheduleArp()`, `coreStep()`, `v6ArpSequence()`
- **DOM**: `.v17-arp-deck`, `#v17ArpToggle`, `[data-arp-rate]`, `[data-arp-ratchet]`
- **CSS**: `v6.css`, `v17.css`, `v18.css`, `v19.css`, `v22.css`, `v27.css`, `v28.css`
- **Persistence**: Project snapshot
- **Current Owner**: `core-performance.js`, `core-performance-fixes.js`, `v18.js`, `v17.js`, `v6.js`
- **Canonical Owner**: `src/arp-engine.js`, `src/scheduler.js`

---

### FEATURE: Audio-Reactive ARP Visualizer
- **State**: Analyser node, RAF handle, active note frequencies
- **Functions**: `v6PaintArp()`, `v16ResizeVisualizer()`
- **DOM**: `.v7-arp-canvas`, `.v17-visualizer`
- **CSS**: `v7.css`, `v17.css`, `v22.css`
- **Current Owner**: `core-performance.js`, `v7.js`, `v16.js`
- **Canonical Owner**: `src/arp-engine.js`, `src/play-ui.js`

---

### FEATURE: Tone & FX (M&B Performance Rack)
- **State**: `V17_FX_BOARDS`, `V17_PLAY_FX`, `v17SynthRack`, `v17DriveCurve cache`
- **Functions**: `v17EnsureSynthRack()`, `v17ApplyFx()`, `v17ApplyBoard()`, `v17BindFxRack()`
- **DOM**: `.v17-fx-rack`, `.v17-pedal`, `[data-v17-board]`
- **CSS**: `v17.css`, `v19.css`, `v26.css`
- **Persistence**: `musicandbeats:v19:rack:play`, project snapshot
- **Current Owner**: `v17.js`, `v17-fixes.js`, `v26.js`, `core-performance.js`
- **Canonical Owner**: `src/effects.js`

---

### FEATURE: Record Mode & Multi-Track Looper
- **State**: `session` (bpm, bars, countIn, layers: buffer, gain, volume, muted, pattern, source)
- **Functions**: `newLayer()`, `resetSessionLayers()`, `renderSession()`, `recordCurrentLayer()`, `playSession()`, `stopSession()`
- **Worklet**: `recorder-worklet.js`
- **DOM**: `#recordScreen`, `#recordStage`, `#layerRail`, `#recordLayerBtn`, `.v8-record-toolbar`
- **CSS**: `styles.css`, `v5.css`, `v8.css`
- **Persistence**: IndexedDB `musicandbeats-v3`, localStorage `musicandbeats:v35:projects`
- **Current Owner**: `app.js`, `workflow-fixes.js`, `v5-fixes.js`, `v8.js`, `recorder-worklet.js`
- **Canonical Owner**: `src/recording.js`, `src/record-ui.js`, `recorder-worklet.js`

---

### FEATURE: Mobile/Tablet Looper Interface (V34+)
- **State**: `MB_V34_LOOPER` state (`tracks.keys`, `tracks.bass`, `tracks.beats`, `activeLane`)
- **Functions**: `api.open()`, `api.start()`, `api.stop()`, `api.record()`, `hydrate()`, `persist()`
- **DOM**: `.v34-looper-shell`, `#v34Tracks`, `#v34Transport`
- **CSS**: `v34-looper.css`
- **Persistence**: `musicandbeats:v34:looper`
- **Current Owner**: `v34-looper.js`
- **Canonical Owner**: `src/looper.js`

---

### FEATURE: Project Manager & Persistence
- **State**: `MB_V35.extra`, `currentProjectId`, `currentProjectName`, `projectList()`
- **Functions**: `saveProject()`, `loadProject()`, `deleteProject()`, `newProject()`, `snapshot()`, `applySnapshot()`
- **DOM**: `#saveBtn`, `.v35-projects-dialog`, `.v35-project-item`
- **CSS**: `v35.css`, `v36.css`
- **Persistence**: `musicandbeats:v35:projects`, `musicandbeats:v35:settings`, `musicandbeats:v35:autosave`
- **Current Owner**: `v35-core.js`, `v35-ui.js`, `v36.js`, `v37.js`, `v38.js`
- **Canonical Owner**: `src/projects.js`

---

### FEATURE: Contextual Help & Explain Controls
- **State**: `MB_HELP.registry`, `MB_HELP.mode` ('normal' | 'explain')
- **Functions**: `MB_HELP.open()`, `MB_HELP.explain()`, `MB_HELP.scan()`
- **DOM**: `#mbHelpBtn`, `#mbHelpCenter`, `.mb-help-tooltip`
- **CSS**: `help.css`
- **Current Owner**: `help.js`
- **Canonical Owner**: `src/help.js`

---

### FEATURE: Performance Profiling Tool
- **State**: `MB_PERF`, `totals` (voices/sec, oscillators/sec, drift ms)
- **Functions**: `MB_PERF.start()`, `MB_PERF.renderReport()`
- **DOM**: `#mbPerfOverlay`
- **CSS**: `perf-debug.css`
- **Current Owner**: `perf-debug.js`
- **Canonical Owner**: `src/perf-debug.js`

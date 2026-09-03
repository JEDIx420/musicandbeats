# Music & Beats — Runtime File Inventory

Every file in the repository runtime is analyzed below for its actual responsibility, overrides, final ownership destination, and classification (`KEEP`, `MERGE`, `SUPERSEDED`, `DEBUG`, `DELETE-CANDIDATE`).

## JavaScript Files (47 total)

| File | Loaded? | Size | Purpose | Defines / Responsibilities | Wraps / Overrides | Final Owner Module | Classification | Notes |
|---|---|---|---|---|---|---|---|---|
| `app.js` | Yes (HTML) | 33,510 B | Foundational runtime | AudioContext, basic synthesizer, step sequencer, record loop | Base implementation | `audio-engine.js`, `state.js`, `instruments/`, `groove-box.js`, `recording.js` | MERGE | Core foundation. Many functions (`startVoice`, `renderKeyboard`, etc.) get overridden later. |
| `workflow-fixes.js` | Yes (HTML) | 7,512 B | Early workflow fixes | Layer navigation, arming, timer cleanup | Early `recordCurrentLayer`, session steps | `recording.js`, `record-ui.js` | MERGE | Small event listener and timing fixes. |
| `v4-fixes.js` | Yes (HTML) | 14,595 B | Expression controls & Bass | `v4Expr()`, velocity/sustain/tone/space inputs | Wraps `startVoice` for envelope | `effects.js`, `instruments/bass.js` | MERGE | Expression sliders and initial bass presets. |
| `v5-fixes.js` | Yes (HTML) | 12,313 B | Track controls & Mixer | Mute/Solo, volume sliders, track rendering | Wraps `renderLayerTools`, `renderSession` | `record-ui.js`, `recording.js` | MERGE | Track strip controls. |
| `v5-hotfix.js` | Yes (HTML) | 761 B | Hotfix for v5 track gain | Safety null checks on layer gain | Layer gain accessor | `recording.js` | MERGE | Tiny safety guard. |
| `v6.js` | Yes (HTML) | 34,979 B | Major workstation layer | Smart Keys chord intervals, Guitar rig, original Arp Lab, Tracks timeline | Extends `renderPlayInstrument`, `getLayerBus` | `instruments/smart-keys.js`, `instruments/guitar.js`, `arp-engine.js` | MERGE | Huge foundation for guitar pedals, chord types, timeline toggle. |
| `v6-patch.js` | Yes (HTML) | 5,823 B | Fixes for v6 timeline/guitar | Guitar meter cleanup, timeline event delegation | Patches v6 event handlers | `instruments/guitar.js`, `record-ui.js` | MERGE | Cleanup patches over v6. |
| `v7.js` | Yes (HTML) | 17,242 B | Ascending ARP & UI | Arp visualizer canvas, ascending octave engine | Overrides `v6ArpTick`, visualizer loop | `arp-engine.js`, `play-ui.js` | MERGE | Visualizer math and octave expansion. |
| `v8.js` | Yes (HTML) | 8,749 B | Record command bar & Boot | Boot splash screen, settings dialog, loads `v9.js` | Modifies `#settingsDialog`, `#recordScreen` | `app-core.js`, `record-ui.js` | MERGE | Boot splash + dynamic loader gateway. |
| `v9.js` | Yes (v8) | 6,015 B | Touch guard & Loader | Touch guards (`selectstart`, etc.), loads entire patch chain | Global event guards, chain loader | `app-core.js` | MERGE | Touch gesture hardening + dynamic script loader. |
| `v10.js` | Yes (v9) | 7,658 B | Audio input gain & normalize | Input gain normalization, mic meter, input boost | Wraps `getLayerBus`, `renderLayerTools` | `recording.js`, `instruments/guitar.js` | MERGE | Mic gain calibration and normalization. |
| `v12.js` | Yes (v9) | 3,576 B | iPad interaction hardening | Fastclick prevention, pointer event normalization | Touch/pointer listeners | `app-core.js` | MERGE | iPad touch optimizations. |
| `v13.js` | Yes (v9) | 4,697 B | Bass hard-stop | `voice.hardStop()`, prevents bass note hanging on transport stop | Wraps `startVoice`, `stopSession` | `audio-engine.js`, `instruments/bass.js` | MERGE | Hard note kill semantics. |
| `v14.js` | Yes (v9) | 3,076 B | Smart Keys latch (v1) | Initial latching implementation | Overridden by v18 latch | None (superseded) | SUPERSEDED | Replaced completely by V18 explicit global latch. |
| `v15.js` | Yes (v9) | 12,846 B | Bass Arp + Beat styles | Arp targeting bass, additional beat genres | Extends `renderPlayInstrument`, `v6StartArp` | `arp-engine.js`, `instruments/bass.js` | MERGE | Bass ARP routing. |
| `v16.js` | Yes (v9) | 5,751 B | UI stability | Visualizer canvas resize guard | Guards `v6PaintArp` | `arp-engine.js` | MERGE | Canvas RAF guards. |
| `v17.js` | Yes (v9) | 32,036 B | Sound library & Hardware UI | Rich synth/bass presets, M&B Performance Rack, hardware knobs, EDM arp | Overhauls `startVoice`, `SOUND_PRESETS` | `audio-engine.js`, `effects.js`, `arp-engine.js` | MERGE | Vital: synth presets, drive curve, pedal FX graph, rotary knob UI. |
| `v17-fixes.js` | Yes (v9) | 9,617 B | FX routing & panic | Disconnects FX cleanly on panic | Wraps `panic`, `getLayerBus` | `effects.js`, `audio-engine.js` | MERGE | Audio node leak prevention on panic. |
| `v17-post.js` | Yes (v9) | 1,303 B | Polish for v17 knobs | Knob double-click reset to default | Patches knob listeners | `play-ui.js` | MERGE | Knob UX polish. |
| `v18.js` | Yes (v9) | 32,784 B | Explicit Latch & Groove Box | Explicit Latch switches, wave-deck Arp UI, hardware Groove Box (density, sync, swing, human, punch, fill) | Redefines latch, Groove Box generation | `state.js`, `instruments/smart-keys.js`, `groove-box.js`, `arp-engine.js` | MERGE | Vital: authoritative Groove Box engine & latch controls. |
| `v18-fixes.js` | Yes (v9) | 2,232 B | Fixes for v18 ARP latch | Ensures latched chords release when Arp disabled | Patches `v18SetLatch` | `arp-engine.js` | MERGE | Latch release edge cases. |
| `v19.js` | Yes (v9) | 8,891 B | Fast Arp & Expanded Rack | 1/32 and 1/64 Arp rates, collapsible rack state | Extends Arp rates, localStorage rack | `arp-engine.js`, `effects.js` | MERGE | High subdivision rates and persistence. |
| `v22.js` | Yes (v9) | 11,874 B | Arp reactive UI | Live visual step indicator and Arp Deck styling | Enhances `v6PaintArp` | `arp-engine.js`, `play-ui.js` | MERGE | Active step visualization. |
| `v23.js` | Yes (v9) | 6,359 B | Latch performance | Debounced latch event handlers | Patches latch click listeners | `instruments/smart-keys.js` | MERGE | Touch event debouncing for latch. |
| `v24.js` | Yes (v9) | 7,885 B | Horizontal racks & drawers | Module drawers (`v24BuildPlayStack`) | Restructures Play DOM sections | `play-ui.js` | MERGE | Play workstation drawer layout. |
| `v25.js` | Yes (v9) | 5,147 B | Drawer state persistence | `v25Persist()`, drawer open/close rules | Wraps drawer toggle events | `play-ui.js` | MERGE | Drawer collapse persistence without implicit close bugs. |
| `v26.js` | Yes (v9) | 8,789 B | Performance rack singleton | Ensures single FX rack per context | Overrides duplicate rack builders | `effects.js` | MERGE | Rack deduplication. |
| `v27.js` | Yes (v9) | 3,186 B | Arp polish | Ratchet and swing control polish | Refines Arp control ranges | `arp-engine.js` | MERGE | Control step calibration. |
| `v28.js` | Yes (v9) | 3,622 B | Arp motion/offset polish | Motion modes (Up, Down, Ping-Pong, Octave) | Refines motion calculations | `arp-engine.js` | MERGE | Arp motion formulas. |
| `v29.js` | Yes (v9) | 6,517 B | Help hooks preparation | Adds `data-help` attributes to UI elements | Decorates elements with help keys | `help.js` | MERGE | Help ID mapping. |
| `core-performance.js` | Yes (v9) | 13,479 B | Web Audio look-ahead scheduler & Voice pool | `MB_CORE_V2`: 40-slot voice pool, rate-aware release envelope, cached drive curves, throttled voice badges | Replaces recursive setTimeout Arp with AudioContext look-ahead | `scheduler.js`, `audio-engine.js`, `arp-engine.js` | MERGE | Vital: performance core foundation for glitch-free 1/64 Arp. |
| `core-performance-fixes.js` | Yes (v9) | 1,602 B | Core perf patches | Fixes pool voice stealing under extreme load | Patches `MB_CORE_V2.pool` | `scheduler.js`, `audio-engine.js` | MERGE | Voice stealing safety. |
| `ui-core.js` | Yes (v9) | 5,069 B | UI Core abstraction | Common UI helpers, drawer event coordination | Coordinates drawer states | `play-ui.js` | MERGE | Drawer event helper. |
| `help.js` | Yes (v9) | 37,172 B | Contextual Help system | `MB_HELP`: Help registry (60+ items), Explain Controls mode, desktop hover tooltips, mobile modal | Full help system | `help.js` | MERGE | Essential user documentation & interactive help. |
| `keyboard-ui.js` | Yes (v9) | 4,322 B | Keyboard geometry & displayed octaves | `MB_KEYBOARD_UI`: 1–3 displayed octaves, proper black key positioning percentages | Overrides `renderKeyboard` | `instruments/smart-keys.js` | MERGE | Explicit keyboard geometry math. |
| `v34-looper.js` | Yes (v9) | 25,724 B | Mobile/Tablet backing looper | `MB_V34_LOOPER`: Event-based Keys/Bass/Beat looper locked to master clock, Keherwa/Dadra styles, Indian instruments | Standalone looper engine | `looper.js` | MERGE | Essential mobile looper and backing track engine. |
| `v35-core.js` | Yes (v9) | 6,704 B | Project snapshots & styles | `MB_V35`: Named project CRUD, autosave, snapshot import/export, style presets | Persistence engine | `projects.js` | MERGE | Authoritative project saving and recall. |
| `v35-ui.js` | Yes (v9) | 7,971 B | Project manager UI | Project modal, project list, new/save/delete dialogs | UI for projects | `projects.js`, `play-ui.js` | MERGE | Project selector and manager UI. |
| `v35.js` | Yes (v9) | 204 B | V35 bootstrap marker | Sets `window.MB_V35_LOADED=true` | None | None | SUPERSEDED | Redundant one-line marker file. |
| `v36.js` | Yes (v9) | 6,677 B | Project cleanup & release | Release-all guards when loading projects | Clean project switches | `projects.js`, `looper.js` | MERGE | State reset on project switch. |
| `v37.js` | Yes (v9) | 15,529 B | Lead lane & Backing mixer | `MB_V37`: Backing mixer (beats/keys/bass/lead levels), lead scale pentatonic keyboards | Adds mixer and lead lane | `instruments/lead.js`, `looper.js` | MERGE | Multi-track mixer and scale mapping. |
| `v38.js` | Yes (v9) | 22,017 B | Chromatic Lead keyboard, samples & deep FX | `MB_V38`: True chromatic/keytar Lead keyboard, SoundFont / GeneralUser GS sample loader, 20 deep FX presets (Auto Wah, Deep Phaser, Cathedral, Ping Pong, etc.) | Overhauls Lead into full chromatic instrument | `instruments/lead.js`, `effects.js` | MERGE | Authoritative Lead instrument implementation. |
| `v38-stability.js` | Yes (v9) | 1,127 B | Lead stability guard | Prevents legacy observers from hijacking V38 Lead card | Locks V38 Lead card binding | `instruments/lead.js` | MERGE | Lead UI ownership guard. |
| `perf-debug.js` | Dev (`?debug=perf`) | 14,004 B | Performance profiler | Live metrics HUD, long-task monitoring, benchmark runner | Hooks `startVoice`, `v6ArpTick` | `perf-debug.js` | DEBUG | Keep as optional development profiler. |
| `recorder-worklet.js` | Yes (AudioWorklet) | 2,325 B | Frame-exact audio recorder | Native AudioWorkletProcessor for recording PCM chunks | Independent worklet | `recorder-worklet.js` | KEEP | Critical: exact sample capture without timer drift. |
| `sw.js` | Yes (Browser) | 2,751 B | Service Worker | Cache management and offline support | PWA caching | `sw.js` | MERGE | Needs updating to cache canonical files instead of historical chain. |
| `update-guard.js` | Yes (v8) | 1,258 B | Cache buster / updater | Checks `build-version.json` and updates service worker | Auto-update prompt | `update-guard.js` | KEEP | Clean self-contained updater. |

---

## CSS Files (33 total)

| File | Loaded In | Size | Purpose | Final Destination | Classification | Notes |
|---|---|---|---|---|---|---|
| `styles.css` | `index.html` | 20,998 B | Core app shell, layout, typography, buttons | `styles.css` | MERGE | Base design system. |
| `brand-v11.css` | Cache only | 1,102 B | Brand logo styling | `styles.css` | MERGE | Minor typography/logo tweaks. |
| `help.css` | Dynamic (`v9.js`) | 8,638 B | Help Center modal, tooltip styling | `styles.css` / `help.css` | MERGE | Contextual help styles. Non-invasive. |
| `keyboard-ui.css` | Dynamic (`v9.js`) | 1,002 B | Displayed octaves selector and key widths | `styles.css` | MERGE | Explicit keyboard sizing. |
| `perf-debug.css` | Dev only | 2,631 B | Performance profiler overlay | `perf-debug.css` | DEBUG | Dev profiler styling. |
| `v4.css` | `index.html` | 2,633 B | Early expression slider styles | `styles.css` | MERGE | Sliders and controls. |
| `v5.css` | `index.html` | 8,007 B | Mixer strip and track controls | `styles.css` | MERGE | Record screen tracks. |
| `v6.css` | `index.html` | 16,334 B | Guitar rig, Smart Keys, pedalboards | `styles.css` | MERGE | Pedalboards and guitar amps. |
| `v6-patch.css` | `index.html` | 472 B | Fixes for timeline toggle | `styles.css` | MERGE | Timeline adjustments. |
| `v7.css` | `index.html` | 5,174 B | Canvas visualizer styles | `styles.css` | MERGE | Waveform display. |
| `v8.css` | `index.html` | 8,337 B | Boot splash & settings dialog | `styles.css` | MERGE | Modal and boot splash. |
| `v9.css` | Dynamic (`v8.js`) | 3,514 B | Expression drawer toggles | `styles.css` | MERGE | Expression collapsible shell. |
| `v10.css` | Dynamic (`v9.js`) | 3,878 B | Audio input calibration meter | `styles.css` | MERGE | Input level meter. |
| `v12.css` | Dynamic (`v9.js`) | 3,748 B | Tablet touch tap target sizes | `styles.css` | MERGE | Minimum touch sizes. |
| `v14.css` | Dynamic (`v9.js`) | 1,176 B | Old latch styles | Superseded | SUPERSEDED | Replaced by v18 latch styles. |
| `v15.css` | Dynamic (`v9.js`) | 3,789 B | Bass arp and genre selector | `styles.css` | MERGE | Selector styling. |
| `v16.css` | Dynamic (`v9.js`) | 2,435 B | Layout stabilization | `styles.css` | MERGE | Overflow fixes. |
| `v17.css` | Dynamic (`v9.js`) | 13,332 B | Performance rack, rotary knobs | `styles.css` | MERGE | Hardware knobs & rack enclosure. |
| `v18.css` | Dynamic (`v9.js`) | 13,930 B | Global LATCH switch, hardware Groove Box | `styles.css` | MERGE | Latch button, 16-step drum deck. |
| `v19.css` | Dynamic (`v9.js`) | 2,665 B | Collapsible rack shells | `styles.css` | MERGE | Shell headers. |
| `v22.css` | Dynamic (`v9.js`) | 11,126 B | Arp Deck reactive step indicators | `styles.css` | MERGE | Active step glow. |
| `v23.css` | Dynamic (`v9.js`) | 961 B | Latch button active states | `styles.css` | MERGE | Button styling. |
| `v24.css` | Dynamic (`v9.js`) | 7,646 B | Play workspace horizontal drawers | `styles.css` | MERGE | Modular drawer system. |
| `v25.css` | Dynamic (`v9.js`) | 1,543 B | Drawer collapse animations | `styles.css` | MERGE | Smooth accordion transitions. |
| `v26.css` | Dynamic (`v9.js`) | 1,509 B | FX rack container sizing | `styles.css` | MERGE | Rack layout. |
| `v27.css` | Dynamic (`v9.js`) | 6,255 B | Arp deck slider adjustments | `styles.css` | MERGE | Control alignments. |
| `v28.css` | Dynamic (`v9.js`) | 4,864 B | Motion control layout | `styles.css` | MERGE | Motion selector buttons. |
| `v29.css` | Dynamic (`v9.js`) | 979 B | Help icon badges | `styles.css` | MERGE | `?` badge positioning. |
| `v34-looper.css` | Dynamic (`v9.js`) | 10,908 B | Mobile/Tablet looper interface | `styles.css` | MERGE | Dedicated looper screen. |
| `v35.css` | Dynamic (`v9.js`) | 4,671 B | Project manager dialog | `styles.css` | MERGE | Project drawer and dialogs. |
| `v36.css` | Dynamic (`v9.js`) | 1,415 B | Project selector cleanups | `styles.css` | MERGE | Project item cards. |
| `v37.css` | Dynamic (`v9.js`) | 3,167 B | Backing mixer faders & Lead lane | `styles.css` | MERGE | Volume faders. |
| `v38.css` | Dynamic (`v9.js`) | 4,256 B | Chromatic Lead keyboard & Keytar styling | `styles.css` | MERGE | Real piano lead keyboard styling. |

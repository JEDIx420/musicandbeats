# Music & Beats — Performance/Core Refactor

This document defines the controlled refactor program for preserving the current workstation feature set while making high-rate ARP playback, UI interaction and long sessions substantially more efficient and predictable.

## Constraints

- Preserve current musical features and project compatibility.
- Keep the app dependency-light: vanilla JavaScript, Web Audio API and native browser APIs.
- Do not remove 1/64, Ratchet, motion, FX, Groove Box, recording, projects or the ARP visualizer as a shortcut to performance.
- Measure before and after every performance change.
- Avoid feature work during the core refactor except the planned contextual Help system.

## Phase 1 — Baseline instrumentation

A profiler is available only when the app is opened with `?debug=perf`. Normal users do not load the profiler.

Metrics:

- ARP ticks / second
- Synth voices started / second
- Oscillator nodes started / second
- Estimated live voices and oscillator pressure, including release tails
- FX application calls / second and average runtime
- `primeAudio()` calls / second
- ARP visualizer frames / second and average draw time
- Play-stack rebuilds / second
- ARP normalization / restore calls / second
- DOM mutations / second
- FPS and event-loop lag
- Long tasks where the browser supports the Long Tasks API
- JS heap usage where the browser exposes `performance.memory`

### Standard benchmark scenarios

Run each for at least 10 seconds on desktop and tablet:

1. Smart Keys, Studio Grand, ARP 1/8, Ratchet 1.
2. Smart Keys, Studio Grand, ARP 1/32, Ratchet 1.
3. Smart Keys, Studio Grand, ARP 1/64, Ratchet 1.
4. Smart Keys, Neon Supersaw, ARP 1/64, Ratchet 1.
5. Smart Keys, Neon Supersaw, ARP 1/64, Ratchet 4.
6. Smart Keys, Neon Supersaw, Chord Pulse, ARP 1/64, Ratchet 4.
7. Bass, Reese Bass, ARP 1/64, Ratchet 4.
8. Repeat a heavy scenario with Arp Lab collapsed to isolate visualizer cost.
9. Repeat while Groove Box is running to measure combined load.

For each scenario use the on-screen `Run 10s sample` button and copy the resulting report.

## Phase 2 — Audio-clock ARP scheduler

Replace recursive `setTimeout()` note scheduling with a Web Audio look-ahead scheduler.

- JavaScript scheduler wakes at a modest fixed cadence.
- Musical events are scheduled ahead against `AudioContext.currentTime`.
- Ratchets are scheduled as audio events rather than independent timer trees.
- Swing, rhythm masks, motion, retrigger and 1/64 remain intact.
- Visualizer trigger events consume scheduler output but do not control timing.

Success criteria:

- lower scheduler drift under UI load;
- bounded timer/callback volume;
- no audible regression at slower ARP rates.

## Phase 3 — Voice lifecycle and polyphony

Create separate performance envelopes for manually played notes and machine-generated ARP notes.

- ARP release derives from rate and Gate.
- Track voices until oscillator nodes actually finish.
- Add a measured polyphony ceiling with deterministic voice stealing.
- Reduce unnecessary node allocation where safe.
- Preserve rich multi-oscillator presets.

## Phase 4 — Remove work from the note hot path

- `primeAudio()` becomes idempotent and UI-free after initialization.
- FX curves and impulse resources are cached.
- FX parameters update when controls change, not per synth note.
- Voice/polyphony badges update on a throttled UI cadence.
- Audio callbacks never rebuild UI.

## Phase 5 — Explicit workstation state and UI ownership

Eliminate state races between historical patch layers.

Introduce a small native state/event layer for:

- ARP settings and transport state
- Play drawer state
- Instrument selection
- FX state
- Groove Box state

A parameter change updates only its state and affected control. It never reconstructs the containing panel.

Retire broad MutationObservers after explicit lifecycle events replace them.

This phase is responsible for permanently eliminating the ARP drawer close/double-toggle behavior.

## Phase 6 — Visualizer optimization

Keep the live ARP scope, but reduce its cost:

- one persistent analyser connection;
- `ResizeObserver` instead of per-frame layout measurement;
- cached background/grid;
- gradients recreated only after resize/theme change;
- drawing suspended when collapsed, hidden or offscreen;
- target 24–30 FPS.

## Phase 7 — Runtime consolidation

Collapse historical version patches into maintainable native modules, for example:

- `audio-engine.js`
- `instrument-engine.js`
- `effects-engine.js`
- `arp-engine.js`
- `groove-engine.js`
- `recording-engine.js`
- `projects.js`
- `workstation-state.js`
- `workstation-ui.js`
- `visualizer.js`
- `help.js`
- `perf-debug.js`

No framework or bundler is required.

## Phase 8 — Contextual Help system

Add one central help registry. Interactive controls receive stable help IDs such as:

- `arp.rate`
- `arp.gate`
- `arp.ratchet`
- `arp.motion`
- `smartkeys.latch`
- `groove.swing`
- `fx.chorus`
- `record.countIn`

The registry powers:

- desktop hover/focus tooltips;
- touch-friendly info affordances;
- click/tap help dialogs;
- a global Help button;
- Help Mode for discovering controls;
- a searchable beginner Help Center with Quick Jam and Build a Loop walkthroughs.

Use one delegated interaction layer rather than one listener per help icon.

## Merge discipline

Each major phase is a separate pull request. Every performance PR must include before/after profiler captures for the standard scenarios and a regression check across desktop, tablet and narrow/mobile layouts.

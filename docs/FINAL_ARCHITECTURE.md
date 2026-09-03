# Music & Beats — Consolidated Canonical Architecture

### 1. Overview
Music & Beats is a responsive, web-based mobile loop workstation and live performance synthesizer built entirely with vanilla JavaScript, modern Web Audio API, and AudioWorklet capabilities.

Following architectural consolidation, all historical versioned patch files (`v4.js` through `v39.js`) have been superseded by a clean, modular canonical runtime located under `src/`.

---

### 2. Canonical Directory Structure

```
├── index.html                   # Minimal production HTML shell (mounts #app)
├── manifest.webmanifest         # PWA configuration
├── sw.js                        # Modernized v40 precache service worker
├── update-guard.js              # Safe client cache-invalidation handler
├── build-version.json           # Build metadata (v40)
├── recorder-worklet.js          # Dedicated AudioWorklet for sample-accurate recording
├── icon.svg                     # Vector application icon
├── assets/instruments/          # Instrument vector icons
├── .github/workflows/ci.yml     # Automated multi-phase CI & GitHub Pages deployment
│
└── src/
    ├── main.js                  # Production composition & bootstrap entrypoint
    ├── app-core.js              # Screen navigation, touch hardening, panic coordinator
    ├── state.js                 # Pure musical calculations, tuning, presets, clamp helpers
    ├── audio-engine.js          # Web Audio graph, voice pool (40 slots), panic, hard-stop
    ├── scheduler.js             # Look-ahead Web Audio clock (1/4 to 1/64 & triplets)
    ├── effects.js               # Performance Rack boards & V39 Lead Deep FX graph
    ├── arp-engine.js            # Pure scheduler-driven arpeggiator engine
    ├── groove-box.js            # 16-step rhythm programmer with 10 genre styles
    ├── recording.js             # AudioWorklet coordinator for drift-free looper takes
    ├── looper.js                # Multi-track backing looper session & event playback
    ├── projects.js              # Backward-compatible project management & serialization
    ├── play-ui.js               # Play workspace UI controller (4 performance lanes)
    ├── record-ui.js             # Record & looper workspace UI controller
    ├── help.js                  # Help Center registry & Explain Controls subsystem
    ├── styles.css               # Single consolidated design system & responsive stylesheet
    └── instruments/
        ├── smart-keys.js        # 7 chord pads, 33+ chord catalog, Keys transpose, Latch
        ├── bass.js              # 7 synth bass presets, Bass transpose, Bass Latch
        ├── guitar.js            # MediaStream input rig, live RMS meter, amp & pedals
        └── lead.js              # Chromatic keyboard, 44 GS voices, pitch bend & mod strips
```

---

### 3. Core Architectural Highlights

- **Pure Look-Ahead Scheduling**: Musical timing is driven strictly by Web Audio `ctx.currentTime` look-ahead cycles (25ms wake, 100ms look-ahead horizon). All legacy `setTimeout` recursive loops have been eliminated.
- **Zero Drift Recording**: Track recording communicates directly with `recorder-worklet.js` using sample-frame indices, guaranteeing phase alignment across multi-track loop repetitions.
- **Unified Audio Ownership**: A single `AudioEngine` singleton owns the master bus, bus compressor, voice allocation pool, and instantaneous `panic()` method.
- **Observer-Free UI**: The canonical UI layer directly manages and updates its DOM components, rendering legacy `MutationObserver` workarounds completely obsolete.
- **Single Cohesive Stylesheet**: 34 legacy stylesheets have been consolidated into `src/styles.css` with zero legacy version-number classes and near-zero `!important` tags.

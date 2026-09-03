/**
 * Music & Beats — Canonical Play UI Subsystem (Play-First Experience)
 *
 * Core Workstation Layout:
 * 1. Global Transport & Master Beat Bar (Start Audio, Play/Pause, Tempo BPM, Groove Style, Energy)
 * 2. Groove Box Beat Sequencer Panel (16-step Kick, Snare, Hat grid with procedural variations)
 * 3. Instrument Performance Lane (Smart Keys, Bass, Guitar, Lead)
 *    - Smart Keys: 7 editable chord pads, Voicing, Transpose, Latch, Full chord editor dialog
 *    - Bass: 7 Bass presets, Transpose, Latch, 4 performance pads
 *    - Guitar: Connect rig, Live RMS meter, Amp patch selector, Trim/Tone sliders
 *    - Lead: Piano keyboard with white and black keys, 44 GeneralUser GS voices, Glide slider, Pitch & Mod strips
 * 4. Expandable Jam Drawers (Arp Lab, Tone & FX Performance Rack)
 */

import { smartKeys, SMART_CHORD_TYPES } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { guitarRig } from './instruments/guitar.js';
import { leadInstrument, LEAD_VOICE_GROUPS } from './instruments/lead.js';
import { arpEngine, ARP_PATTERNS, ARP_RATES } from './arp-engine.js';
import { grooveBox, GROOVE_STYLES } from './groove-box.js';
import { performanceRack, PERFORMANCE_BOARDS } from './effects.js';
import { scheduler } from './scheduler.js';
import { audioEngine } from './audio-engine.js';
import { NOTES, midiLabel } from './state.js';
import { helpSubsystem } from './help.js';

export class PlayUI {
  constructor(container = null) {
    this.container = container;
    this.activeLane = 'keys'; // 'keys' | 'bass' | 'guitar' | 'lead'
    this.openDrawer = 'none'; // 'none' | 'arp' | 'rack'
    this.editingPadSlot = null; // null or 0..6 for chord editor modal

    this.boundListeners = [];
    this.unsubscribers = [];
  }

  // ==========================================================================
  // 1. VIEW MODELS
  // ==========================================================================

  getSmartKeysViewModel() {
    const padModels = [];
    for (let i = 0; i < 7; i++) {
      const chord = smartKeys.chords[i] || { root: 'C', type: 'Major', custom: '' };
      const midis = smartKeys.resolvePadMidis(i);
      padModels.push({
        slot: i,
        root: chord.root,
        type: chord.type,
        custom: chord.custom,
        label: chord.type === 'Major' ? chord.root : `${chord.root}${chord.type}`,
        midis,
        midiLabels: midis.map(m => midiLabel(m)),
        isLatched: smartKeys.latchedSlot === i
      });
    }

    return {
      key: smartKeys.key,
      preset: smartKeys.preset,
      voicing: smartKeys.voicing,
      transpose: smartKeys.transpose,
      isLatchEnabled: smartKeys.isLatchEnabled,
      pads: padModels
    };
  }

  getBassViewModel() {
    const baseMidi = bassInstrument.resolveNoteMidi(bassInstrument.key, bassInstrument.octave);
    const notes = [
      { name: bassInstrument.key, midi: baseMidi },
      { name: 'IV', midi: baseMidi + 5 },
      { name: 'V',  midi: baseMidi + 7 },
      { name: 'Oct', midi: baseMidi + 12 }
    ];

    return {
      preset: bassInstrument.preset,
      key: bassInstrument.key,
      octave: bassInstrument.octave,
      transpose: bassInstrument.transpose,
      isLatchEnabled: bassInstrument.isLatchEnabled,
      latchedNote: bassInstrument.latchedNote,
      notes
    };
  }

  getGuitarViewModel() {
    return {
      connected: guitarRig.connected,
      patch: guitarRig.patch,
      trim: guitarRig.trim,
      tone: guitarRig.tone,
      output: guitarRig.output,
      monitor: guitarRig.monitor,
      pedals: { ...guitarRig.pedals },
      meter: { ...guitarRig.meterData }
    };
  }

  getLeadViewModel() {
    return {
      layout: leadInstrument.layout,
      startOctave: leadInstrument.startOctave,
      displayOctaves: leadInstrument.displayOctaves,
      voice: leadInstrument.voice,
      voiceGroups: LEAD_VOICE_GROUPS,
      slide: leadInstrument.isSlideEnabled,
      glideMs: leadInstrument.glideMs,
      pitchRange: leadInstrument.pitchRange,
      pitchBend: leadInstrument.pitchBend,
      mod: leadInstrument.mod,
      activePointersCount: leadInstrument.activePointers.size,
      keyboardModel: leadInstrument.getKeyboardLayoutModel()
    };
  }

  getArpViewModel() {
    return {
      enabled: arpEngine.enabled,
      target: arpEngine.target,
      pattern: arpEngine.pattern,
      rate: arpEngine.rate,
      octaves: arpEngine.octaves,
      patterns: ARP_PATTERNS,
      rates: ARP_RATES
    };
  }

  getGrooveBoxViewModel() {
    return {
      style: grooveBox.style,
      energy: grooveBox.energy,
      muted: grooveBox.muted,
      pattern: grooveBox.pattern,
      styles: GROOVE_STYLES,
      currentStep: grooveBox.currentStep
    };
  }

  getPerformanceRackViewModel() {
    return {
      board: performanceRack.board,
      boards: Object.keys(PERFORMANCE_BOARDS),
      state: performanceRack.state
    };
  }

  // ==========================================================================
  // 2. LIFECYCLE & MOUNT
  // ==========================================================================

  mount(root = this.container) {
    if (!root) return;
    this.container = root;
    this.unmount();
    this.render();

    this.unsubscribers.push(smartKeys.subscribe(() => this.renderLane()));
    this.unsubscribers.push(bassInstrument.subscribe(() => this.renderLane()));
    this.unsubscribers.push(guitarRig.subscribe(() => this.renderLane()));
    this.unsubscribers.push(leadInstrument.subscribe(() => this.renderLane()));
    this.unsubscribers.push(arpEngine.subscribe(() => this.renderDrawers()));
    this.unsubscribers.push(grooveBox.subscribe(() => this.renderBeatSequencer()));
  }

  unmount() {
    this.boundListeners.forEach(({ element, event, handler, options }) => {
      try { element.removeEventListener(event, handler, options); } catch {}
    });
    this.boundListeners = [];

    this.unsubscribers.forEach(unsub => {
      try { unsub(); } catch {}
    });
    this.unsubscribers = [];

    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  listen(element, event, handler, options = false) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    this.boundListeners.push({ element, event, handler, options });
  }

  // ==========================================================================
  // 3. MAIN WORKSPACE RENDERING
  // ==========================================================================

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mb-play-workspace" role="region" aria-label="Music & Beats Jam Workspace">

        <!-- 1. Master Transport & Beat Bar -->
        <section class="mb-master-transport">
          <div class="mb-transport-left">
            <button class="mb-btn-audio-start" type="button">
              <span>◉</span> Start Audio
            </button>
            <button class="mb-btn-beat-play ${scheduler.isRunning ? 'active' : ''}" type="button" aria-label="Toggle Beat Transport">
              ${scheduler.isRunning ? '■ Stop' : '▶ Play Beat'}
            </button>
          </div>

          <div class="mb-transport-center">
            <div class="mb-tempo-box">
              <button class="mb-bpm-btn mb-bpm-down" type="button">−</button>
              <label>
                <small>BPM</small>
                <input class="mb-bpm-input" type="number" min="40" max="220" value="${scheduler.bpm}">
              </label>
              <button class="mb-bpm-btn mb-bpm-up" type="button">+</button>
            </div>
            <label class="mb-transport-field">
              <small>STYLE</small>
              <select class="mb-groove-style-sel">
                ${GROOVE_STYLES.map(s => `<option value="${s}" ${s === grooveBox.style ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
            <label class="mb-transport-field">
              <small>ENERGY (<span class="mb-energy-val">${grooveBox.energy}</span>)</small>
              <input class="mb-energy-slider" type="range" min="1" max="5" value="${grooveBox.energy}">
            </label>
          </div>

          <div class="mb-transport-right">
            <button class="mb-btn-variation" type="button">⚡ New Variation</button>
            <button class="mb-btn-toggle-groove ${this.showGrooveGrid ? 'active' : ''}" type="button">🥁 Step Grid</button>
          </div>
        </section>

        <!-- 2. Groove Box 16-Step Grid (Inline or Collapsible) -->
        <section id="mbBeatSequencer" class="mb-beat-sequencer-card"></section>

        <!-- 3. Primary Instrument Selector Tabs -->
        <nav class="mb-instrument-tabs" role="tablist" aria-label="Choose Instrument">
          <button role="tab" aria-selected="${this.activeLane === 'keys'}" class="mb-tab-btn ${this.activeLane === 'keys' ? 'active' : ''}" data-lane="keys">
            🎹 Smart Keys
          </button>
          <button role="tab" aria-selected="${this.activeLane === 'bass'}" class="mb-tab-btn ${this.activeLane === 'bass' ? 'active' : ''}" data-lane="bass">
            ♩ Bass
          </button>
          <button role="tab" aria-selected="${this.activeLane === 'guitar'}" class="mb-tab-btn ${this.activeLane === 'guitar' ? 'active' : ''}" data-lane="guitar">
            🎸 Guitar Rig
          </button>
          <button role="tab" aria-selected="${this.activeLane === 'lead'}" class="mb-tab-btn ${this.activeLane === 'lead' ? 'active' : ''}" data-lane="lead">
            ✨ Lead Solo
          </button>
        </nav>

        <!-- 4. Active Instrument Performance Stage -->
        <section id="mbActiveLane" class="mb-lane-stage"></section>

        <!-- 5. Secondary Tools: Arp Lab & Tone/FX Drawers -->
        <footer class="mb-tools-bar" role="toolbar" aria-label="Performance Drawers">
          <button class="mb-tool-btn ${this.openDrawer === 'arp' ? 'active' : ''}" data-drawer="arp">⚡ Arp Lab</button>
          <button class="mb-tool-btn ${this.openDrawer === 'rack' ? 'active' : ''}" data-drawer="rack">🎛 Tone &amp; FX</button>
        </footer>
        <div id="mbActiveDrawer" class="mb-drawer-container"></div>
      </div>
    `;

    this.bindTransportControls();
    this.bindNavigationAndDrawers();
    this.renderBeatSequencer();
    this.renderLane();
    this.renderDrawers();
  }

  // ==========================================================================
  // 4. TRANSPORT & BEAT SEQUENCER BINDINGS
  // ==========================================================================

  bindTransportControls() {
    const audioBtn = this.container.querySelector('.mb-btn-audio-start');
    this.listen(audioBtn, 'click', () => {
      audioEngine.primeAudio();
      audioBtn.classList.add('ready');
      audioBtn.innerHTML = '<span>●</span> Audio On';
    });

    const playBtn = this.container.querySelector('.mb-btn-beat-play');
    this.listen(playBtn, 'click', () => {
      if (scheduler.isRunning) {
        scheduler.stop();
        grooveBox.stop();
      } else {
        audioEngine.primeAudio();
        grooveBox.start();
        scheduler.start();
      }
      playBtn.classList.toggle('active', scheduler.isRunning);
      playBtn.textContent = scheduler.isRunning ? '■ Stop' : '▶ Play Beat';
    });

    this.listen(this.container.querySelector('.mb-bpm-down'), 'click', () => {
      scheduler.setBpm(scheduler.bpm - 1);
      this.updateBpmDisplay();
    });

    this.listen(this.container.querySelector('.mb-bpm-up'), 'click', () => {
      scheduler.setBpm(scheduler.bpm + 1);
      this.updateBpmDisplay();
    });

    this.listen(this.container.querySelector('.mb-bpm-input'), 'change', (e) => {
      scheduler.setBpm(+e.target.value);
      this.updateBpmDisplay();
    });

    this.listen(this.container.querySelector('.mb-groove-style-sel'), 'change', (e) => {
      grooveBox.loadStyle(e.target.value);
      this.renderBeatSequencer();
    });

    this.listen(this.container.querySelector('.mb-energy-slider'), 'input', (e) => {
      const val = +e.target.value;
      grooveBox.energy = val;
      grooveBox.loadStyle(grooveBox.style, val);
      const disp = this.container.querySelector('.mb-energy-val');
      if (disp) disp.textContent = val;
      this.renderBeatSequencer();
    });

    this.listen(this.container.querySelector('.mb-btn-variation'), 'click', () => {
      grooveBox.loadStyle(grooveBox.style, grooveBox.energy, true);
      this.renderBeatSequencer();
    });

    this.listen(this.container.querySelector('.mb-btn-toggle-groove'), 'click', (e) => {
      const card = this.container.querySelector('#mbBeatSequencer');
      card.classList.toggle('expanded');
      e.target.classList.toggle('active');
    });
  }

  updateBpmDisplay() {
    const input = this.container?.querySelector('.mb-bpm-input');
    if (input) input.value = scheduler.bpm;
  }

  renderBeatSequencer() {
    const host = this.container?.querySelector('#mbBeatSequencer');
    if (!host) return;

    const vm = this.getGrooveBoxViewModel();
    const rows = [
      { name: 'KICK', id: 'kick', steps: vm.pattern.kick },
      { name: 'SNARE', id: 'snare', steps: vm.pattern.snare },
      { name: 'HI-HAT', id: 'hat', steps: vm.pattern.hat }
    ];

    host.innerHTML = `
      <div class="mb-seq-grid">
        ${rows.map(r => `
          <div class="mb-seq-row" data-inst="${r.id}">
            <span class="mb-seq-inst-label">${r.name}</span>
            <div class="mb-seq-steps">
              ${r.steps.map((on, idx) => `
                <button class="mb-seq-step ${on ? 'on' : ''} ${idx === vm.currentStep ? 'current' : ''}" data-step="${idx}" type="button" aria-label="${r.name} step ${idx + 1}"></button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    host.querySelectorAll('.mb-seq-step').forEach(btn => {
      this.listen(btn, 'click', (e) => {
        const row = e.target.closest('.mb-seq-row');
        if (!row) return;
        const inst = row.dataset.inst;
        const step = +btn.dataset.step;
        grooveBox.toggleStep(inst, step);
        btn.classList.toggle('on');
      });
    });
  }

  bindNavigationAndDrawers() {
    const tabNav = this.container.querySelector('.mb-instrument-tabs');
    this.listen(tabNav, 'click', (e) => {
      const btn = e.target.closest('[data-lane]');
      if (!btn) return;
      this.activeLane = btn.dataset.lane;
      tabNav.querySelectorAll('[data-lane]').forEach(b => {
        const isMatch = b.dataset.lane === this.activeLane;
        b.classList.toggle('active', isMatch);
        b.setAttribute('aria-selected', String(isMatch));
      });
      this.renderLane();
    });

    const drawerBar = this.container.querySelector('.mb-tools-bar');
    this.listen(drawerBar, 'click', (e) => {
      const btn = e.target.closest('[data-drawer]');
      if (!btn) return;
      this.openDrawer = this.openDrawer === btn.dataset.drawer ? 'none' : btn.dataset.drawer;
      drawerBar.querySelectorAll('[data-drawer]').forEach(b => {
        b.classList.toggle('active', b.dataset.drawer === this.openDrawer);
      });
      this.renderDrawers();
    });
  }

  // ==========================================================================
  // 5. INSTRUMENT PERFORMANCE LANES
  // ==========================================================================

  renderLane() {
    const laneHost = this.container?.querySelector('#mbActiveLane');
    if (!laneHost) return;

    if (this.activeLane === 'keys') {
      laneHost.innerHTML = this.buildSmartKeysHTML();
      this.bindSmartKeysHandlers(laneHost);
    } else if (this.activeLane === 'bass') {
      laneHost.innerHTML = this.buildBassHTML();
      this.bindBassHandlers(laneHost);
    } else if (this.activeLane === 'guitar') {
      laneHost.innerHTML = this.buildGuitarHTML();
      this.bindGuitarHandlers(laneHost);
    } else if (this.activeLane === 'lead') {
      laneHost.innerHTML = this.buildLeadHTML();
      this.bindLeadHandlers(laneHost);
    }
  }

  buildSmartKeysHTML() {
    const vm = this.getSmartKeysViewModel();
    return `
      <div class="mb-smart-keys-view">
        <header class="mb-lane-toolbar">
          <div class="mb-lane-toolbar-group">
            <label>Key
              <select class="mb-select-key">
                ${NOTES.map(n => `<option value="${n}" ${n === vm.key ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
            <label>Voicing
              <select class="mb-select-voicing">
                <option value="close" ${vm.voicing === 'close' ? 'selected' : ''}>Close</option>
                <option value="open" ${vm.voicing === 'open' ? 'selected' : ''}>Open</option>
                <option value="wide" ${vm.voicing === 'wide' ? 'selected' : ''}>Wide</option>
              </select>
            </label>
            <label>Transpose
              <select class="mb-select-transpose">
                ${Array.from({ length: 25 }, (_, i) => i - 12).map(st =>
                  `<option value="${st}" ${st === vm.transpose ? 'selected' : ''}>${st > 0 ? '+' : ''}${st} st</option>`
                ).join('')}
              </select>
            </label>
          </div>
          <div class="mb-lane-toolbar-group">
            <button class="mb-btn-latch ${vm.isLatchEnabled ? 'active' : ''}" type="button" aria-pressed="${vm.isLatchEnabled}">
              🔒 Latch
            </button>
          </div>
        </header>

        <!-- 7 Chord Pads -->
        <div class="mb-chord-pad-grid">
          ${vm.pads.map(p => `
            <div class="mb-pad-card ${p.isLatched ? 'latched' : ''}">
              <button class="mb-chord-pad" data-slot="${p.slot}" type="button">
                <span class="mb-pad-num">${p.slot + 1}</span>
                <strong class="mb-pad-label">${p.label}</strong>
                <small class="mb-pad-notes">${p.midiLabels.join(' ')}</small>
              </button>
              <button class="mb-btn-edit-chord" data-slot="${p.slot}" type="button" aria-label="Edit chord ${p.slot + 1}">✏️</button>
            </div>
          `).join('')}
        </div>

        <!-- Chord Editor Dialog Container -->
        <div id="mbChordEditorModal"></div>
      </div>
    `;
  }

  bindSmartKeysHandlers(host) {
    this.listen(host.querySelector('.mb-select-key'), 'change', (e) => {
      smartKeys.setKey(e.target.value);
    });
    this.listen(host.querySelector('.mb-select-voicing'), 'change', (e) => {
      smartKeys.setVoicing(e.target.value);
    });
    this.listen(host.querySelector('.mb-select-transpose'), 'change', (e) => {
      smartKeys.setTranspose(+e.target.value);
    });
    this.listen(host.querySelector('.mb-btn-latch'), 'click', () => {
      smartKeys.setLatchEnabled(!smartKeys.isLatchEnabled);
    });

    // Chord pad pointerdown / pointerup
    host.querySelectorAll('.mb-chord-pad').forEach(pad => {
      this.listen(pad, 'pointerdown', (e) => {
        e.preventDefault();
        if (helpSubsystem.isExplainMode) {
          helpSubsystem.showTopic('smart.key');
          return;
        }
        const slot = +pad.dataset.slot;
        smartKeys.startPad(slot, { pointerId: e.pointerId });
      });
      const onUp = (e) => {
        smartKeys.releasePad(e.pointerId);
      };
      this.listen(pad, 'pointerup', onUp);
      this.listen(pad, 'pointercancel', onUp);
    });

    // Edit Chord buttons
    host.querySelectorAll('.mb-btn-edit-chord').forEach(btn => {
      this.listen(btn, 'click', () => {
        this.openChordEditor(+btn.dataset.slot);
      });
    });
  }

  openChordEditor(slot) {
    const modalHost = this.container.querySelector('#mbChordEditorModal');
    if (!modalHost) return;

    const chord = smartKeys.chords[slot] || { root: 'C', type: 'Major', custom: '' };
    modalHost.innerHTML = `
      <div class="mb-chord-editor-backdrop">
        <div class="mb-chord-editor-card">
          <header class="mb-chord-editor-header">
            <h3>Customize Pad ${slot + 1}</h3>
            <button class="mb-close-editor" type="button">✕</button>
          </header>
          <div class="mb-chord-editor-fields">
            <label>Root
              <select class="mb-edit-root">
                ${NOTES.map(n => `<option value="${n}" ${n === chord.root ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
            <label>Chord Type
              <select class="mb-edit-type">
                ${Object.keys(SMART_CHORD_TYPES).map(t => `<option value="${t}" ${t === chord.type ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </label>
            <label>Custom Semitones (e.g. 0,4,7,11)
              <input class="mb-edit-custom" type="text" value="${chord.custom || ''}" placeholder="0, 4, 7, 11">
            </label>
          </div>
          <footer class="mb-chord-editor-footer">
            <button class="mb-btn-save-chord" type="button">Apply to Pad ${slot + 1}</button>
          </footer>
        </div>
      </div>
    `;

    const close = () => { modalHost.innerHTML = ''; };
    this.listen(modalHost.querySelector('.mb-close-editor'), 'click', close);
    this.listen(modalHost.querySelector('.mb-btn-save-chord'), 'click', () => {
      const root = modalHost.querySelector('.mb-edit-root').value;
      const type = modalHost.querySelector('.mb-edit-type').value;
      const custom = modalHost.querySelector('.mb-edit-custom').value;
      smartKeys.setChord(slot, { root, type, custom });
      close();
      this.renderLane();
    });
  }

  buildBassHTML() {
    const vm = this.getBassViewModel();
    return `
      <div class="mb-bass-view">
        <header class="mb-lane-toolbar">
          <div class="mb-lane-toolbar-group">
            <label>Bass Preset
              <select class="mb-bass-preset-sel">
                ${['Sub Bass', 'Deep Club Sub', 'Reese Bass', 'Acid Bass', 'FM House Bass', 'Pluck Bass', 'Future Growl'].map(p =>
                  `<option value="${p}" ${p === vm.preset ? 'selected' : ''}>${p}</option>`
                ).join('')}
              </select>
            </label>
            <label>Transpose
              <select class="mb-bass-transpose">
                ${Array.from({ length: 25 }, (_, i) => i - 12).map(st =>
                  `<option value="${st}" ${st === vm.transpose ? 'selected' : ''}>${st > 0 ? '+' : ''}${st} st</option>`
                ).join('')}
              </select>
            </label>
          </div>
          <button class="mb-btn-bass-latch ${vm.isLatchEnabled ? 'active' : ''}" type="button" aria-pressed="${vm.isLatchEnabled}">
            🔒 Latch
          </button>
        </header>

        <div class="mb-bass-pad-grid">
          ${vm.notes.map(n => `
            <button class="mb-bass-pad ${vm.latchedNote === n.midi ? 'latched' : ''}" data-midi="${n.midi}" type="button">
              <strong class="mb-bass-pad-name">${n.name}</strong>
              <small class="mb-bass-pad-label">${midiLabel(n.midi)}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  bindBassHandlers(host) {
    this.listen(host.querySelector('.mb-bass-preset-sel'), 'change', (e) => {
      bassInstrument.setPreset(e.target.value);
    });
    this.listen(host.querySelector('.mb-bass-transpose'), 'change', (e) => {
      bassInstrument.setTranspose(+e.target.value);
    });
    this.listen(host.querySelector('.mb-btn-bass-latch'), 'click', () => {
      bassInstrument.setLatchEnabled(!bassInstrument.isLatchEnabled);
    });
    host.querySelectorAll('.mb-bass-pad').forEach(pad => {
      this.listen(pad, 'pointerdown', (e) => {
        e.preventDefault();
        const midi = +pad.dataset.midi;
        bassInstrument.startNote(midi, { pointerId: e.pointerId });
      });
      const onUp = (e) => {
        bassInstrument.releaseNote(e.pointerId);
      };
      this.listen(pad, 'pointerup', onUp);
      this.listen(pad, 'pointercancel', onUp);
    });
  }

  buildGuitarHTML() {
    const vm = this.getGuitarViewModel();
    return `
      <div class="mb-guitar-view">
        <header class="mb-lane-toolbar">
          <button class="mb-guitar-connect-btn ${vm.connected ? 'active' : ''}" type="button">
            ${vm.connected ? '🔌 Disconnect Rig' : '🎸 Connect Audio Input'}
          </button>
          <span class="mb-guitar-meter-badge ${vm.meter.signalDetected ? 'live' : ''}">${vm.meter.dbv} dB</span>
        </header>
        <div class="mb-guitar-controls">
          <label>Amp Patch
            <select class="mb-guitar-patch-sel">
              ${['Clean Glass', 'Warm Combo', 'Edge Crunch', 'Arena Lead', 'Ambient Swell', 'Worship Shimmer'].map(p =>
                `<option value="${p}" ${p === vm.patch ? 'selected' : ''}>${p}</option>`
              ).join('')}
            </select>
          </label>
          <label>Input Trim <input class="mb-guitar-trim" type="range" min="0" max="1.5" step="0.05" value="${vm.trim}"></label>
          <label>Tone Clarity <input class="mb-guitar-tone" type="range" min="1000" max="14000" step="500" value="${vm.tone}"></label>
        </div>
      </div>
    `;
  }

  bindGuitarHandlers(host) {
    this.listen(host.querySelector('.mb-guitar-connect-btn'), 'click', () => {
      if (guitarRig.connected) {
        guitarRig.disconnectInput();
      } else {
        guitarRig.connectInput();
      }
    });
    this.listen(host.querySelector('.mb-guitar-patch-sel'), 'change', (e) => {
      guitarRig.loadPatch(e.target.value);
    });
    this.listen(host.querySelector('.mb-guitar-trim'), 'input', (e) => {
      guitarRig.setTrim(+e.target.value);
    });
    this.listen(host.querySelector('.mb-guitar-tone'), 'input', (e) => {
      guitarRig.setTone(+e.target.value);
    });
  }

  buildLeadHTML() {
    const vm = this.getLeadViewModel();
    return `
      <div class="mb-lead-view">
        <header class="mb-lane-toolbar">
          <label>Lead Voice
            <select class="mb-lead-voice-sel">
              ${Object.entries(vm.voiceGroups).map(([grp, voices]) => `
                <optgroup label="${grp}">
                  ${voices.map(v => `<option value="${v}" ${v === vm.voice ? 'selected' : ''}>${v}</option>`).join('')}
                </optgroup>
              `).join('')}
            </select>
          </label>
          <label>Glide (<span class="mb-glide-val">${vm.glideMs}ms</span>)
            <input class="mb-lead-glide" type="range" min="0" max="300" step="5" value="${vm.glideMs}">
          </label>
          <label>Pitch Bend
            <select class="mb-lead-range">
              ${[2, 7, 12].map(r => `<option value="${r}" ${r === vm.pitchRange ? 'selected' : ''}>±${r} st</option>`).join('')}
            </select>
          </label>
        </header>

        <!-- Strips & Full Piano Keyboard Stage -->
        <div class="mb-lead-perf-shell">
          <aside class="mb-lead-strips">
            <div class="mb-perf-strip pitch" data-help="lead.pitchStrip"><span>PITCH</span></div>
            <div class="mb-perf-strip mod" data-help="lead.modStrip"><span>MOD</span></div>
          </aside>
          <div class="mb-lead-keys-stage">
            ${vm.keyboardModel.whiteKeys.map(w => `
              <div class="mb-key white" data-midi="${w.midi}"><span>${w.label}</span></div>
            `).join('')}
            ${vm.keyboardModel.blackKeys.map(b => `
              <div class="mb-key black" data-midi="${b.midi}" style="left: ${b.leftPct}%; width: ${b.widthPct}%;"></div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  bindLeadHandlers(host) {
    this.listen(host.querySelector('.mb-lead-voice-sel'), 'change', (e) => {
      leadInstrument.setVoice(e.target.value);
    });
    this.listen(host.querySelector('.mb-lead-glide'), 'input', (e) => {
      leadInstrument.setGlideMs(+e.target.value);
      const disp = host.querySelector('.mb-glide-val');
      if (disp) disp.textContent = `${e.target.value}ms`;
    });
    this.listen(host.querySelector('.mb-lead-range'), 'change', (e) => {
      leadInstrument.setPitchRange(+e.target.value);
    });

    // Pitch strip
    const pitchStrip = host.querySelector('.mb-perf-strip.pitch');
    if (pitchStrip) {
      let activePointer = null;
      this.listen(pitchStrip, 'pointerdown', (e) => {
        e.preventDefault();
        activePointer = e.pointerId;
        pitchStrip.setPointerCapture?.(activePointer);
        const rect = pitchStrip.getBoundingClientRect();
        leadInstrument.setPitchBend(1 - 2 * ((e.clientY - rect.top) / rect.height));
      });
      this.listen(pitchStrip, 'pointermove', (e) => {
        if (e.pointerId === activePointer) {
          const rect = pitchStrip.getBoundingClientRect();
          leadInstrument.setPitchBend(1 - 2 * ((e.clientY - rect.top) / rect.height));
        }
      });
      const onEnd = (e) => {
        if (e.pointerId === activePointer) {
          activePointer = null;
          leadInstrument.releasePitchBend();
        }
      };
      this.listen(pitchStrip, 'pointerup', onEnd);
      this.listen(pitchStrip, 'pointercancel', onEnd);
    }

    // Lead keys
    host.querySelectorAll('.mb-key').forEach(k => {
      this.listen(k, 'pointerdown', (e) => {
        e.preventDefault();
        const midi = +k.dataset.midi;
        leadInstrument.onPointerDown(e.pointerId, midi, k);
      });
      const onUp = (e) => {
        leadInstrument.onPointerUp(e.pointerId);
      };
      this.listen(k, 'pointerup', onUp);
      this.listen(k, 'pointercancel', onUp);
    });
  }

  // ==========================================================================
  // 6. EXPANDABLE TOOLS DRAWERS (Arp Lab, Performance Rack)
  // ==========================================================================

  renderDrawers() {
    const drawerHost = this.container?.querySelector('#mbActiveDrawer');
    if (!drawerHost) return;

    if (this.openDrawer === 'none') {
      drawerHost.innerHTML = '';
      return;
    }

    if (this.openDrawer === 'arp') {
      const vm = this.getArpViewModel();
      drawerHost.innerHTML = `
        <div class="mb-drawer-panel">
          <header class="mb-drawer-header"><strong>⚡ Arp Lab (BPM-Locked Arpeggiator)</strong></header>
          <div class="mb-drawer-body">
            <label class="mb-toggle-label">
              <input type="checkbox" class="mb-arp-toggle" ${vm.enabled ? 'checked' : ''}>
              <span>Enable Arpeggiator</span>
            </label>
            <label>Rate
              <select class="mb-arp-rate">
                ${vm.rates.map(r => `<option value="${r}" ${r === vm.rate ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </label>
            <label>Pattern
              <select class="mb-arp-pattern">
                ${vm.patterns.map(p => `<option value="${p}" ${p === vm.pattern ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </label>
            <label>Octaves
              <select class="mb-arp-octaves">
                ${[1, 2, 3, 4].map(o => `<option value="${o}" ${o === vm.octaves ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>
      `;
      this.listen(drawerHost.querySelector('.mb-arp-toggle'), 'change', (e) => {
        arpEngine.setEnabled(e.target.checked);
      });
      this.listen(drawerHost.querySelector('.mb-arp-rate'), 'change', (e) => {
        arpEngine.setRate(e.target.value);
      });
      this.listen(drawerHost.querySelector('.mb-arp-pattern'), 'change', (e) => {
        arpEngine.setPattern(e.target.value);
      });
      this.listen(drawerHost.querySelector('.mb-arp-octaves'), 'change', (e) => {
        arpEngine.setOctaves(+e.target.value);
      });
    } else if (this.openDrawer === 'rack') {
      const vm = this.getPerformanceRackViewModel();
      drawerHost.innerHTML = `
        <div class="mb-drawer-panel">
          <header class="mb-drawer-header"><strong>🎛 M&amp;B Performance Rack (Tone &amp; FX)</strong></header>
          <div class="mb-drawer-body">
            <label>Rack Board
              <select class="mb-rack-board">
                ${vm.boards.map(b => `<option value="${b}" ${b === vm.board ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>
      `;
      this.listen(drawerHost.querySelector('.mb-rack-board'), 'change', (e) => {
        performanceRack.loadBoard(e.target.value);
      });
    }
  }
}

// Global Singleton Instance
export const playUI = new PlayUI();

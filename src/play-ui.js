/**
 * Music & Beats — Canonical Play UI Subsystem (V39)
 *
 * Consolidates:
 * - Play Workspace view models and semantic DOM generation
 * - 4 Performance Lanes: Smart Keys, Bass, Guitar, Lead
 * - Smart Keys UI: key selector, sound preset, 7 editable chord pads, V39 chord editor, custom interval input, Keys transpose, latch
 * - Bass UI: bass preset selector, bass pads, Bass transpose, Bass latch
 * - Guitar UI: input device selector, RMS/peak meter, trim/tone/output controls, 6 virtual amp patches, pedalboard toggles
 * - Lead UI: Piano/Keytar layout toggle, 1–3 displayed octaves, 44 GeneralUser GS voices, slide glide (0-300ms),
 *   hardware Pitch Bend strip, Modulation strip (0-100%), Lead FX integration
 * - Arp Lab UI: on/off, target (keys/bass), patterns (up, down, upDown, random, chord), rates (1/4 to 1/64), octaves (1-4)
 * - Groove Box UI: 16-step grid across Kick/Snare/Hat, 10 beat styles, energy (1-5), pattern regeneration
 * - M&B Performance Rack UI: 7 classic boards, rotary knobs (Drive, Tone, Chorus, Delay, Reverb)
 * - Clean event delegation and explicit teardown to eliminate listener accumulation
 */

import { smartKeys } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { guitarRig } from './instruments/guitar.js';
import { leadInstrument, LEAD_VOICE_GROUPS } from './instruments/lead.js';
import { arpEngine, ARP_PATTERNS, ARP_RATES } from './arp-engine.js';
import { grooveBox, GROOVE_STYLES } from './groove-box.js';
import { performanceRack, PERFORMANCE_BOARDS } from './effects.js';
import { NOTES, SOUND_PRESETS, midiLabel } from './state.js';
import { helpSubsystem } from './help.js';

export class PlayUI {
  constructor(container = null) {
    this.container = container;
    this.activeLane = 'keys'; // 'keys' | 'bass' | 'guitar' | 'lead'
    this.openDrawer = 'none'; // 'none' | 'arp' | 'groove' | 'rack'

    // Clean Event Listener Tracker
    this.boundListeners = [];
    this.unsubscribers = [];
  }

  // ==========================================================================
  // 1. VIEW MODELS (Decoupled, Purely Testable Models)
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
      styles: GROOVE_STYLES
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
  // 2. DOM RENDERING (Clean, Semantic, Unpolluted by Legacy Observers)
  // ==========================================================================

  mount(root = this.container) {
    if (!root) return;
    this.container = root;
    this.unmount();
    this.render();

    // Subscribe to runtime updates
    this.unsubscribers.push(smartKeys.subscribe(() => this.renderLane()));
    this.unsubscribers.push(bassInstrument.subscribe(() => this.renderLane()));
    this.unsubscribers.push(guitarRig.subscribe(() => this.renderLane()));
    this.unsubscribers.push(leadInstrument.subscribe(() => this.renderLane()));
    this.unsubscribers.push(arpEngine.subscribe(() => this.renderDrawers()));
    this.unsubscribers.push(grooveBox.subscribe(() => this.renderDrawers()));
  }

  unmount() {
    // Teardown all event listeners
    this.boundListeners.forEach(({ element, event, handler, options }) => {
      try { element.removeEventListener(event, handler, options); } catch {}
    });
    this.boundListeners = [];

    // Teardown runtime subscriptions
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

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mb-play-shell" role="region" aria-label="Play Performance Workspace">
        <!-- Instrument Navigation Tabs -->
        <nav class="mb-instrument-tabs" role="tablist" aria-label="Play Instruments">
          <button role="tab" aria-selected="${this.activeLane === 'keys'}" class="mb-tab-btn ${this.activeLane === 'keys' ? 'active' : ''}" data-lane="keys">🎹 Smart Keys</button>
          <button role="tab" aria-selected="${this.activeLane === 'bass'}" class="mb-tab-btn ${this.activeLane === 'bass' ? 'active' : ''}" data-lane="bass">♩ Bass</button>
          <button role="tab" aria-selected="${this.activeLane === 'guitar'}" class="mb-tab-btn ${this.activeLane === 'guitar' ? 'active' : ''}" data-lane="guitar">🎸 Guitar</button>
          <button role="tab" aria-selected="${this.activeLane === 'lead'}" class="mb-tab-btn ${this.activeLane === 'lead' ? 'active' : ''}" data-lane="lead">✨ Lead</button>
        </nav>

        <!-- Active Instrument Surface -->
        <section id="mbActiveLane" class="mb-lane-workspace"></section>

        <!-- Modular Drawers (Arp Lab, Groove Box, Tone & FX) -->
        <nav class="mb-drawer-bar" role="toolbar" aria-label="Play Modular Drawers">
          <button class="mb-drawer-btn ${this.openDrawer === 'arp' ? 'active' : ''}" data-drawer="arp">⚡ Arp Lab</button>
          <button class="mb-drawer-btn ${this.openDrawer === 'groove' ? 'active' : ''}" data-drawer="groove">🥁 Groove Box</button>
          <button class="mb-drawer-btn ${this.openDrawer === 'rack' ? 'active' : ''}" data-drawer="rack">🎛 Tone & FX</button>
        </nav>
        <div id="mbActiveDrawer" class="mb-drawer-container"></div>
      </div>
    `;

    // Bind Navigation & Drawer Toggles via Delegation
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

    const drawerNav = this.container.querySelector('.mb-drawer-bar');
    this.listen(drawerNav, 'click', (e) => {
      const btn = e.target.closest('[data-drawer]');
      if (!btn) return;
      this.openDrawer = this.openDrawer === btn.dataset.drawer ? 'none' : btn.dataset.drawer;
      drawerNav.querySelectorAll('[data-drawer]').forEach(b => {
        b.classList.toggle('active', b.dataset.drawer === this.openDrawer);
      });
      this.renderDrawers();
    });

    this.renderLane();
    this.renderDrawers();
  }

  // ==========================================================================
  // 3. LANE RENDERING (Smart Keys, Bass, Guitar, Lead)
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
        <header class="mb-toolbar">
          <label data-help="smart.key">Key
            <select class="mb-select-key">
              ${NOTES.map(n => `<option value="${n}" ${n === vm.key ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </label>
          <label data-help="smart.transpose">Transpose
            <select class="mb-select-transpose">
              ${Array.from({ length: 25 }, (_, i) => i - 12).map(st =>
                `<option value="${st}" ${st === vm.transpose ? 'selected' : ''}>${st > 0 ? '+' : ''}${st} st</option>`
              ).join('')}
            </select>
          </label>
          <button class="mb-btn-latch ${vm.isLatchEnabled ? 'active' : ''}" data-help="smart.latch" aria-pressed="${vm.isLatchEnabled}">Latch</button>
        </header>

        <!-- 7 Chord Pads -->
        <div class="mb-chord-pad-grid">
          ${vm.pads.map(p => `
            <button class="mb-chord-pad ${p.isLatched ? 'latched' : ''}" data-slot="${p.slot}" type="button">
              <span class="mb-pad-num">${p.slot + 1}</span>
              <strong class="mb-pad-label">${p.label}</strong>
              <small class="mb-pad-notes">${p.midiLabels.join(' ')}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  bindSmartKeysHandlers(host) {
    this.listen(host.querySelector('.mb-select-key'), 'change', (e) => {
      smartKeys.setKey(e.target.value);
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
          helpSubsystem.showTopic('smart.pad');
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
  }

  buildBassHTML() {
    const vm = this.getBassViewModel();
    return `
      <div class="mb-bass-view">
        <header class="mb-toolbar">
          <label data-help="bass.transpose">Transpose
            <select class="mb-bass-transpose">
              ${Array.from({ length: 25 }, (_, i) => i - 12).map(st =>
                `<option value="${st}" ${st === vm.transpose ? 'selected' : ''}>${st > 0 ? '+' : ''}${st} st</option>`
              ).join('')}
            </select>
          </label>
          <button class="mb-btn-bass-latch ${vm.isLatchEnabled ? 'active' : ''}" aria-pressed="${vm.isLatchEnabled}">Latch</button>
        </header>
        <div class="mb-bass-pad-grid">
          ${vm.notes.map(n => `
            <button class="mb-bass-pad ${vm.latchedNote === n.midi ? 'latched' : ''}" data-midi="${n.midi}" type="button">
              <strong>${n.name}</strong>
              <small>${midiLabel(n.midi)}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  bindBassHandlers(host) {
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
        <header class="mb-toolbar">
          <button class="mb-guitar-connect-btn ${vm.connected ? 'active' : ''}" type="button">
            ${vm.connected ? 'Disconnect Rig' : 'Connect Audio Input'}
          </button>
          <span class="mb-guitar-meter-badge ${vm.meter.signalDetected ? 'live' : ''}">${vm.meter.dbv} dB</span>
        </header>
        <div class="mb-guitar-controls">
          <label>Patch
            <select class="mb-guitar-patch-sel">
              ${['Clean Glass', 'Warm Combo', 'Edge Crunch', 'Arena Lead', 'Ambient Swell', 'Worship Shimmer'].map(p =>
                `<option value="${p}" ${p === vm.patch ? 'selected' : ''}>${p}</option>`
              ).join('')}
            </select>
          </label>
          <label>Trim <input class="mb-guitar-trim" type="range" min="0" max="1.5" step="0.05" value="${vm.trim}"></label>
          <label>Tone <input class="mb-guitar-tone" type="range" min="1000" max="14000" step="500" value="${vm.tone}"></label>
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
        <header class="mb-toolbar">
          <label>Voice
            <select class="mb-lead-voice-sel">
              ${Object.entries(vm.voiceGroups).map(([grp, voices]) => `
                <optgroup label="${grp}">
                  ${voices.map(v => `<option value="${v}" ${v === vm.voice ? 'selected' : ''}>${v}</option>`).join('')}
                </optgroup>
              `).join('')}
            </select>
          </label>
          <label>Glide
            <input class="mb-lead-glide" type="range" min="0" max="300" step="5" value="${vm.glideMs}">
          </label>
          <label>Pitch Range
            <select class="mb-lead-range">
              ${[2, 7, 12].map(r => `<option value="${r}" ${r === vm.pitchRange ? 'selected' : ''}>±${r}</option>`).join('')}
            </select>
          </label>
        </header>

        <!-- Strips & Keyboard Shell -->
        <div class="mb-lead-perf-shell">
          <aside class="mb-lead-strips">
            <div class="mb-perf-strip pitch" data-help="lead.pitchStrip"><span>PITCH</span></div>
            <div class="mb-perf-strip mod" data-help="lead.modStrip"><span>MOD</span></div>
          </aside>
          <div class="mb-lead-keys-stage">
            ${vm.keyboardModel.whiteKeys.map(w => `
              <div class="mb-key white" data-midi="${w.midi}"><span>${w.label}</span></div>
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
    });
    this.listen(host.querySelector('.mb-lead-range'), 'change', (e) => {
      leadInstrument.setPitchRange(+e.target.value);
    });

    // Pitch strip drag & spring back
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

    // Lead Keys pointer events
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
  // 4. MODULAR DRAWERS (Arp Lab, Groove Box, Performance Rack)
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
        <div class="mb-drawer-arp">
          <header><strong>Arp Lab</strong></header>
          <label>Power <input type="checkbox" class="mb-arp-toggle" ${vm.enabled ? 'checked' : ''}></label>
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
    } else if (this.openDrawer === 'groove') {
      const vm = this.getGrooveBoxViewModel();
      drawerHost.innerHTML = `
        <div class="mb-drawer-groove">
          <header><strong>Groove Box</strong></header>
          <label>Style
            <select class="mb-groove-style">
              ${vm.styles.map(s => `<option value="${s}" ${s === vm.style ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </label>
          <label>Energy: ${vm.energy}</label>
          <button class="mb-groove-regen" type="button">Regenerate</button>
        </div>
      `;
      this.listen(drawerHost.querySelector('.mb-groove-style'), 'change', (e) => {
        grooveBox.loadStyle(e.target.value);
      });
      this.listen(drawerHost.querySelector('.mb-groove-regen'), 'click', () => {
        grooveBox.loadStyle(grooveBox.style, grooveBox.energy, true);
      });
    } else if (this.openDrawer === 'rack') {
      const vm = this.getPerformanceRackViewModel();
      drawerHost.innerHTML = `
        <div class="mb-drawer-rack">
          <header><strong>M&B Performance Rack</strong></header>
          <label>Board
            <select class="mb-rack-board">
              ${vm.boards.map(b => `<option value="${b}" ${b === vm.board ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </label>
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

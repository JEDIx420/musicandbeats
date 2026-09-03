/**
 * Music & Beats — Canonical Arpeggiator Engine (V39)
 *
 * Consolidates:
 * - Arpeggiator musical patterns (up, down, upDown, random, chord) (v6.js, v7.js)
 * - Pure Web Audio look-ahead clock scheduling via src/scheduler.js (replaces timer-recursion)
 * - Supported musical rates: 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/64 (no reduction of 1/64 speed)
 * - Multi-octave transposition expansion (1–4 octaves) (v17.js, v19.js)
 * - Smart Keys targeting with full V39 custom chord interval & transpose support (v39-core.js)
 * - Bass lane targeting with octave selection and transpose support (v15.js, v39-core.js)
 * - Bounded 40-slot voice pool allocation via src/audio-engine.js with deterministic stealing
 * - Complete transport and latch integration: no hanging notes, instant stop and pitch clearing
 */

import { audioEngine } from './audio-engine.js';
import { scheduler, LookAheadScheduler } from './scheduler.js';
import { smartKeys } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { clamp } from './state.js';

export const ARP_PATTERNS = ['up', 'down', 'upDown', 'random', 'chord'];
export const ARP_RATES = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/64'];

export class ArpEngine {
  constructor(engine = audioEngine, clock = scheduler) {
    this.engine = engine;
    this.scheduler = clock;

    // Arp Configuration
    this.enabled = false;
    this.target = 'keys'; // 'keys' | 'bass'
    this.pattern = 'up';
    this.rate = '1/16';
    this.octaves = 1; // 1 to 4 octaves
    this.preset = 'Studio Grand';
    this.gate = 0.75; // Note duration as a fraction of step time (0.1 to 0.95)

    // Current Performance Notes Source
    this.activeMidis = []; // Base MIDI notes being arpeggiated
    this.expandedNotes = []; // Notes expanded across octaves and arranged by pattern
    this.noteIndex = 0;
    this.isRunning = false;

    // Scheduler Subscription ID
    this.subscriptionId = 'arp-engine-clock';

    // Diagnostics / Step Tracking
    this.currentStep = 0;
    this.lastAudioTime = 0;

    this.listeners = new Set();
  }

  // ==========================================================================
  // 1. CONFIGURATION
  // ==========================================================================

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.stop();
    }
    this.notify();
  }

  setTarget(target) {
    if (['keys', 'bass'].includes(target)) {
      this.target = target;
      this.syncTargetNotes();
      this.notify();
    }
  }

  setPattern(pattern) {
    if (ARP_PATTERNS.includes(pattern)) {
      this.pattern = pattern;
      this.rebuildSequence();
      this.notify();
    }
  }

  setRate(rate) {
    if (ARP_RATES.includes(rate)) {
      this.rate = rate;
      this.notify();
    }
  }

  setOctaves(octaves) {
    this.octaves = clamp(Math.round(+octaves || 1), 1, 4);
    this.rebuildSequence();
    this.notify();
  }

  setPreset(preset) {
    this.preset = preset;
    this.notify();
  }

  setGate(gate) {
    this.gate = clamp(+gate || 0.75, 0.1, 0.95);
    this.notify();
  }

  // ==========================================================================
  // 2. MUSICAL NOTE RESOLUTION (Target Synchronization)
  // ==========================================================================

  /**
   * Reads the active note set directly from canonical Smart Keys or Bass.
   * Fully respects V39 custom chord intervals, extensions, and Keys/Bass transpose.
   */
  syncTargetNotes() {
    if (this.target === 'keys') {
      // If Smart Keys has a latched slot or held pad, arpeggiate those notes
      const slot = smartKeys.latchedSlot !== null ? smartKeys.latchedSlot : 0;
      this.activeMidis = smartKeys.resolvePadMidis(slot);
      this.preset = smartKeys.preset;
    } else if (this.target === 'bass') {
      const rootMidi = bassInstrument.resolveNoteMidi(bassInstrument.key, bassInstrument.octave);
      // Bass ARP expands across octave and fifth
      this.activeMidis = [rootMidi, rootMidi + 7, rootMidi + 12];
      this.preset = bassInstrument.preset;
    }
    this.rebuildSequence();
  }

  setNotes(midis, preset = this.preset) {
    if (Array.isArray(midis) && midis.length) {
      this.activeMidis = [...midis].sort((a, b) => a - b);
      this.preset = preset;
      this.rebuildSequence();
    }
  }

  // ==========================================================================
  // 3. PATTERN GENERATION & SEQUENCE EXPANSION
  // ==========================================================================

  rebuildSequence() {
    if (!this.activeMidis.length) {
      this.expandedNotes = [];
      return;
    }

    // 1. Expand base notes across specified octave range
    const notesWithOctaves = [];
    for (let o = 0; o < this.octaves; o++) {
      for (const m of this.activeMidis) {
        notesWithOctaves.push(clamp(m + o * 12, 0, 127));
      }
    }

    // 2. Apply pattern order
    const baseAsc = [...notesWithOctaves].sort((a, b) => a - b);

    switch (this.pattern) {
      case 'up':
        this.expandedNotes = baseAsc;
        break;
      case 'down':
        this.expandedNotes = [...baseAsc].reverse();
        break;
      case 'upDown': {
        if (baseAsc.length <= 2) {
          this.expandedNotes = baseAsc;
        } else {
          const descendingMiddle = [...baseAsc].slice(1, -1).reverse();
          this.expandedNotes = [...baseAsc, ...descendingMiddle];
        }
        break;
      }
      case 'random':
        // Shuffled sequence
        this.expandedNotes = [...baseAsc].sort(() => Math.random() - 0.5);
        break;
      case 'chord':
        // All notes triggered together as a staccato pulse
        this.expandedNotes = [baseAsc];
        break;
      default:
        this.expandedNotes = baseAsc;
    }

    this.noteIndex = 0;
  }

  // ==========================================================================
  // 4. TIMING & VOICE POOL SCHEDULING (Canonical Look-Ahead)
  // ==========================================================================

  start() {
    this.engine.primeAudio();
    this.stop();
    this.syncTargetNotes();
    if (!this.expandedNotes.length) return;

    this.isRunning = true;
    this.noteIndex = 0;

    // Subscribe to scheduler step callback
    this.scheduler.onStep(this.subscriptionId, (stepIndex, stepAudioTime) => {
      this.onSchedulerStep(stepIndex, stepAudioTime);
    });

    this.notify();
  }

  stop() {
    this.isRunning = false;
    this.scheduler.offStep(this.subscriptionId);
    if (this.engine.context) {
      this.engine.clearFuturePitch(this.engine.context.currentTime + 0.002);
    }
    this.notify();
  }

  reset() {
    this.stop();
    this.noteIndex = 0;
    this.currentStep = 0;
  }

  /**
   * Called on every tick of the master look-ahead clock.
   * Derives event emission from the configured rate subdivision.
   */
  onSchedulerStep(stepIndex, stepAudioTime) {
    if (!this.isRunning || !this.expandedNotes.length) return;

    const bpm = this.scheduler.bpm;
    const noteDuration = LookAheadScheduler.getSubdivisionSeconds(this.rate, bpm);
    const gateDuration = noteDuration * this.gate;

    const currentItem = this.expandedNotes[this.noteIndex % this.expandedNotes.length];

    if (Array.isArray(currentItem)) {
      // Chord pulse
      currentItem.forEach(m => {
        this.engine.schedulePooledVoice(m, this.preset, 0.78, stepAudioTime, gateDuration);
      });
    } else {
      // Single arpeggiated note
      this.engine.schedulePooledVoice(currentItem, this.preset, 0.82, stepAudioTime, gateDuration);
    }

    this.currentStep = this.noteIndex;
    this.lastAudioTime = stepAudioTime;
    this.noteIndex = (this.noteIndex + 1) % this.expandedNotes.length;
  }

  // ==========================================================================
  // 5. SERIALIZATION & PERSISTENCE
  // ==========================================================================

  serializeState() {
    return {
      enabled: this.enabled,
      target: this.target,
      pattern: this.pattern,
      rate: this.rate,
      octaves: this.octaves,
      preset: this.preset,
      gate: this.gate
    };
  }

  restoreState(data) {
    if (!data) return;
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled;
    if (['keys', 'bass'].includes(data.target)) this.target = data.target;
    if (ARP_PATTERNS.includes(data.pattern)) this.pattern = data.pattern;
    if (ARP_RATES.includes(data.rate)) this.rate = data.rate;
    if (Number.isFinite(data.octaves)) this.octaves = clamp(+data.octaves, 1, 4);
    if (data.preset) this.preset = data.preset;
    if (Number.isFinite(data.gate)) this.gate = clamp(+data.gate, 0.1, 0.95);
    this.rebuildSequence();
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try { listener(this); } catch {}
    }
  }
}

// Global Singleton Instance
export const arpEngine = new ArpEngine();

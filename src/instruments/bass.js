/**
 * Music & Beats — Canonical Bass Instrument System (V39)
 *
 * Consolidates:
 * - Playable Bass instrument with low-frequency synth voices (app.js, v4-fixes.js, v17.js)
 * - Preset library: Sub Bass, Deep Club Sub, Reese Bass, Acid Bass, FM House Bass, Pluck Bass, Future Growl
 * - Dedicated Bass LATCH mode: exclusive lane latch holding the last note (v18.js)
 * - Fast hardStop() note kill on transport stop / lane switch avoiding hanging low notes (v13.js)
 * - Bass Transpose: -12 to +12 semitones affecting live pad MIDI calculation and event transposition (v39-core.js)
 * - Bass ARP target compatibility (v15.js)
 * - Record mode Bass track integration metadata (v34-looper.js, v35-core.js)
 */

import { NOTES, clamp, noteMidi } from '../state.js';
import { audioEngine } from '../audio-engine.js';

export const BASS_PRESETS = [
  'Sub Bass',
  'Deep Club Sub',
  'Reese Bass',
  'Acid Bass',
  'FM House Bass',
  'Pluck Bass',
  'Future Growl'
];

export class BassInstrument {
  constructor(engine = audioEngine) {
    this.engine = engine;

    // Musical State
    this.preset = 'Sub Bass';
    this.key = 'C';
    this.octave = 2; // Default bass register
    this.transpose = 0; // -12 to +12 semitones (V39)

    // Latch & Performance State
    this.isLatchEnabled = false;
    this.latchedNote = null; // MIDI number or pad index
    this.latchedVoice = null;
    this.pointerHolds = new Map(); // pointerId -> { midi, voice }

    this.listeners = new Set();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  setPreset(name) {
    if (BASS_PRESETS.includes(name)) {
      this.preset = name;
      this.notify();
    }
  }

  setKey(key) {
    if (NOTES.includes(key)) {
      this.key = key;
      this.notify();
    }
  }

  setOctave(octave) {
    this.octave = clamp(Math.round(+octave || 2), 1, 4);
    this.notify();
  }

  setTranspose(semitones) {
    const next = clamp(Math.round(+semitones || 0), -12, 12);
    const delta = next - this.transpose;
    this.transpose = next;

    // If a note is latched, retarget or re-trigger with new transposed pitch
    if (this.latchedNote !== null && delta !== 0) {
      const midi = this.latchedNote + delta;
      this.releaseLatch(true);
      this.startNote(midi, { forceLatch: true });
    }
    this.notify();
    return delta;
  }

  setLatchEnabled(enabled) {
    this.isLatchEnabled = !!enabled;
    if (!this.isLatchEnabled) {
      this.releaseLatch(true);
    }
    this.notify();
  }

  // --------------------------------------------------------------------------
  // Note Pitch Calculation
  // --------------------------------------------------------------------------

  resolveNoteMidi(noteName, octave = this.octave) {
    const base = noteMidi(noteName, octave);
    return clamp(base + this.transpose, 0, 127);
  }

  // --------------------------------------------------------------------------
  // Performance Triggering & Hard-Stop Semantics
  // --------------------------------------------------------------------------

  startNote(midi, { pointerId = null, velocity = 0.88, forceLatch = false } = {}) {
    this.engine.primeAudio();

    // If this note is already latched, re-triggering it releases latch
    if (this.isLatchEnabled && this.latchedNote === midi && !forceLatch) {
      this.releaseLatch(true);
      return null;
    }

    // Exclusive bass latch: release previous latched note with fast hardStop
    if (this.isLatchEnabled || forceLatch) {
      this.releaseLatch(true);
    }

    const effectiveMidi = clamp(midi + (forceLatch ? 0 : this.transpose), 0, 127);
    const voice = this.engine.startVoice(effectiveMidi, this.preset, velocity);

    if (this.isLatchEnabled || forceLatch) {
      this.latchedNote = effectiveMidi;
      this.latchedVoice = voice;
    }

    if (pointerId !== null) {
      this.pointerHolds.set(pointerId, { midi: effectiveMidi, voice });
    }

    this.notify();
    return voice;
  }

  releaseNote(pointerId, hard = false) {
    const hold = this.pointerHolds.get(pointerId);
    if (!hold) return;

    // If note is not the currently latched note, stop it
    if (this.latchedNote !== hold.midi) {
      try {
        if (hard && typeof hold.voice?.hardStop === 'function') {
          hold.voice.hardStop();
        } else {
          hold.voice?.stop?.();
        }
      } catch {}
    }

    this.pointerHolds.delete(pointerId);
    this.notify();
  }

  releaseLatch(hard = true) {
    if (this.latchedVoice) {
      try {
        if (hard && typeof this.latchedVoice.hardStop === 'function') {
          this.latchedVoice.hardStop();
        } else {
          this.latchedVoice.stop?.();
        }
      } catch {}
      this.latchedVoice = null;
    }
    this.latchedNote = null;
    this.notify();
  }

  /**
   * Complete transport stop note termination.
   * V13 requirement: ensures no low frequencies hang when playback stops.
   */
  hardStopAll() {
    this.pointerHolds.forEach(hold => {
      try {
        hold.voice?.hardStop?.() || hold.voice?.stop?.();
      } catch {}
    });
    this.pointerHolds.clear();
    this.releaseLatch(true);
  }

  // --------------------------------------------------------------------------
  // Serialization & Project Persistence
  // --------------------------------------------------------------------------

  serializeState() {
    return {
      preset: this.preset,
      key: this.key,
      octave: this.octave,
      transpose: this.transpose,
      isLatchEnabled: this.isLatchEnabled
    };
  }

  restoreState(data) {
    if (!data) return;
    if (data.preset && BASS_PRESETS.includes(data.preset)) this.preset = data.preset;
    if (data.key && NOTES.includes(data.key)) this.key = data.key;
    if (Number.isFinite(data.octave)) this.octave = clamp(+data.octave, 1, 4);
    if (Number.isFinite(data.transpose)) this.transpose = clamp(+data.transpose, -12, 12);
    if (typeof data.isLatchEnabled === 'boolean') this.isLatchEnabled = data.isLatchEnabled;
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
export const bassInstrument = new BassInstrument();

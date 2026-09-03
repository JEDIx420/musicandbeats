/**
 * Music & Beats — Canonical Smart Keys System (V39)
 *
 * Consolidates:
 * - Diatonic chord generation from musical key preset (app.js, v6.js)
 * - 7 independently editable chord pads with root selection (v6.js, v39-core.js)
 * - Full V39 chord type catalog (Major, Minor, Diminished, Augmented, Sus2, Sus4,
 *   Power 5, 6, m6, 7, maj7, m7, dim7, m7b5, add9, madd9, 9, maj9, m9, 11, m11,
 *   13, m13, 6/9, 7sus4, mMaj7, maj7#11, 7b9, 7#9, 7b5, 7#5, add11, madd11)
 * - Custom semitone interval string parsing, validation, duplicate removal, clamping & sorting (e.g. "0,4,7,10,14")
 * - Voicing spreads: close, open, wide (app.js, v6.js)
 * - Keys Transpose: -12 to +12 semitones affecting live pad MIDI calculation and event transposition (v39-core.js)
 * - V39 Keys Latch: exclusive within lane, next pad replaces held, re-tapping active pad releases it,
 *   and custom chords retain full custom MIDI note sets rather than reverting to hardcoded scales (v18.js, v39-core.js)
 * - Number key triggering (1–7)
 * - Mathematical keyboard geometry model for 1–3 displayed octaves (keyboard-ui.js)
 */

import { NOTES, FLAT_MAP, clamp, noteMidi, midiLabel } from '../state.js';
import { audioEngine } from '../audio-engine.js';

// ============================================================================
// 1. CHORD TYPES & DEFINITIONS (V39 Exhaustive Catalog)
// ============================================================================

export const SMART_CHORD_TYPES = {
  'Major':      [0, 4, 7],
  'Minor':      [0, 3, 7],
  'Diminished': [0, 3, 6],
  'Augmented':  [0, 4, 8],
  'Sus2':       [0, 2, 7],
  'Sus4':       [0, 5, 7],
  'Power 5':    [0, 7, 12],
  '6':          [0, 4, 7, 9],
  'm6':         [0, 3, 7, 9],
  '7':          [0, 4, 7, 10],
  'maj7':       [0, 4, 7, 11],
  'm7':         [0, 3, 7, 10],
  'dim7':       [0, 3, 6, 9],
  'm7b5':       [0, 3, 6, 10],
  'add9':       [0, 4, 7, 14],
  'madd9':      [0, 3, 7, 14],
  '9':          [0, 4, 7, 10, 14],
  'maj9':       [0, 4, 7, 11, 14],
  'm9':         [0, 3, 7, 10, 14],
  '11':         [0, 4, 7, 10, 14, 17],
  'm11':        [0, 3, 7, 10, 14, 17],
  '13':         [0, 4, 7, 10, 14, 17, 21],
  'm13':        [0, 3, 7, 10, 14, 17, 21],
  '6/9':        [0, 4, 7, 9, 14],
  '7sus4':      [0, 5, 7, 10],
  'mMaj7':      [0, 3, 7, 11],
  'maj7#11':    [0, 4, 7, 11, 18],
  '7b9':        [0, 4, 7, 10, 13],
  '7#9':        [0, 4, 7, 10, 15],
  '7b5':        [0, 4, 6, 10],
  '7#5':        [0, 4, 8, 10],
  'add11':      [0, 4, 7, 17],
  'madd11':     [0, 3, 7, 17]
};

// ============================================================================
// 2. MUSICAL CHORD ENGINE HELPERS
// ============================================================================

/**
 * Returns diatonic chords for a major key (I, ii, iii, IV, V, vi, vii°).
 */
export function getDiatonicChords(key = 'C') {
  const rootIndex = NOTES.indexOf(key) >= 0 ? NOTES.indexOf(key) : 0;
  const majorScaleSteps = [0, 2, 4, 5, 7, 9, 11];
  const qualities = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
  const romans = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

  return majorScaleSteps.map((step, i) => ({
    root: NOTES[(rootIndex + step) % 12],
    quality: qualities[i],
    roman: romans[i],
    type: qualities[i] === 'minor' ? 'Minor' : qualities[i] === 'dim' ? 'Diminished' : 'Major',
    custom: ''
  }));
}

/**
 * Parses a custom semitone string (e.g. "0, 4, 7, 10, 14").
 * Returns sorted unique integers clamped between 0 and 36 semitones.
 */
export function parseCustomIntervals(str) {
  const trimmed = String(str || '').trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[ ,]+/)
    .map(Number)
    .filter(Number.isFinite)
    .map(n => clamp(Math.round(n), 0, 36))
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .sort((a, b) => a - b);
}

/**
 * Resolves semitone intervals for a chord definition.
 */
export function resolveChordIntervals(chord) {
  if (!chord) return [0, 4, 7];
  if (chord.type === 'Custom') {
    const customList = parseCustomIntervals(chord.custom);
    return customList.length ? customList : [0, 4, 7];
  }
  return SMART_CHORD_TYPES[chord.type] || SMART_CHORD_TYPES.Major;
}

/**
 * Applies voicing spreads to a list of intervals.
 * - close: standard intervals
 * - open: second note raised by an octave (+12)
 * - wide: second note and highest note raised by an octave (+12)
 */
export function applyVoicing(intervals, voicing = 'close') {
  const sorted = [...intervals].sort((a, b) => a - b);
  if (voicing === 'open' && sorted.length > 2) {
    sorted[1] += 12;
  } else if (voicing === 'wide' && sorted.length > 2) {
    sorted[1] += 12;
    sorted[sorted.length - 1] += 12;
  }
  return sorted.sort((a, b) => a - b);
}

/**
 * Returns the human-readable display label for a chord pad (e.g. "C", "Dm", "G7", "F#maj9").
 */
export function formatChordLabel(chord) {
  if (!chord) return '';
  const root = FLAT_MAP[chord.root] || chord.root;
  if (chord.type === 'Major') return root;
  if (chord.type === 'Minor') return `${root}m`;
  if (chord.type === 'Diminished') return `${root}°`;
  if (chord.type === 'Custom') return `${root}*`;
  return `${root}${chord.type}`;
}

// ============================================================================
// 3. SMART KEYS INSTRUMENT CLASS
// ============================================================================

export class SmartKeys {
  constructor(engine = audioEngine) {
    this.engine = engine;

    // Musical State
    this.key = 'C';
    this.voicing = 'close';
    this.octave = 3;
    this.preset = 'Studio Grand';
    this.transpose = 0; // -12 to +12 semitones (V39)
    this.displayedOctaves = 2; // 1, 2, or 3 octaves

    // 7 Editable Chord Slots
    this.chords = getDiatonicChords('C');
    this.chordsCustomized = false;

    // Active Performance / Latch State
    this.isLatchEnabled = false;
    this.latchedSlot = null; // index of currently latched pad (0..6)
    this.latchedVoices = []; // active Voice objects
    this.pointerHolds = new Map(); // pointerId -> { slot, voices, pad }

    // Change Listeners
    this.listeners = new Set();
  }

  // --------------------------------------------------------------------------
  // Configuration & Editing
  // --------------------------------------------------------------------------

  setKey(newKey) {
    if (!NOTES.includes(newKey)) return;
    this.key = newKey;
    if (!this.chordsCustomized) {
      this.chords = getDiatonicChords(newKey);
    }
    this.notify();
  }

  setTranspose(semitones) {
    this.transpose = clamp(Math.round(+semitones || 0), -12, 12);
    // If latch is active, re-trigger with new transposed pitch
    if (this.latchedSlot !== null) {
      const slot = this.latchedSlot;
      this.releaseLatch();
      this.startPad(slot, { forceLatch: true });
    }
    this.notify();
  }

  setVoicing(voicing) {
    if (['close', 'open', 'wide'].includes(voicing)) {
      this.voicing = voicing;
      this.notify();
    }
  }

  setOctave(octave) {
    this.octave = clamp(Math.round(+octave || 3), 1, 6);
    this.notify();
  }

  setSoundPreset(preset) {
    this.preset = preset;
    this.notify();
  }

  setDisplayedOctaves(octaves) {
    this.displayedOctaves = clamp(Math.round(+octaves || 2), 1, 3);
    this.notify();
  }

  setLatchEnabled(enabled) {
    this.isLatchEnabled = !!enabled;
    if (!this.isLatchEnabled) {
      this.releaseLatch();
    }
    this.notify();
  }

  editChordSlot(slotIndex, root, type, custom = '') {
    const idx = clamp(slotIndex, 0, 6);
    this.chords[idx] = {
      root: NOTES.includes(root) ? root : 'C',
      type: SMART_CHORD_TYPES[type] || type === 'Custom' ? type : 'Major',
      custom: custom ? String(custom) : ''
    };
    this.chordsCustomized = true;
    this.notify();
  }

  resetChordSlot(slotIndex) {
    const idx = clamp(slotIndex, 0, 6);
    const defaults = getDiatonicChords(this.key);
    this.chords[idx] = defaults[idx];
    this.notify();
  }

  resetAllChords() {
    this.chords = getDiatonicChords(this.key);
    this.chordsCustomized = false;
    this.notify();
  }

  // --------------------------------------------------------------------------
  // Note & Chord Calculation
  // --------------------------------------------------------------------------

  resolvePadMidis(slotIndex) {
    const idx = clamp(slotIndex, 0, 6);
    const chord = this.chords[idx];
    const rootIndex = Math.max(0, NOTES.indexOf(chord.root));
    const baseMidi = noteMidi('C', this.octave) + rootIndex + this.transpose;
    const intervals = resolveChordIntervals(chord);
    const voiced = applyVoicing(intervals, this.voicing);
    return voiced.map(step => clamp(baseMidi + step, 0, 127));
  }

  // --------------------------------------------------------------------------
  // Performance Triggering & Latch Execution (V39 Semantics)
  // --------------------------------------------------------------------------

  startPad(slotIndex, { pointerId = null, velocity = 0.86, forceLatch = false } = {}) {
    const idx = clamp(slotIndex, 0, 6);
    this.engine.primeAudio();

    // If this pad is currently latched, pressing it again releases the latch
    if (this.isLatchEnabled && this.latchedSlot === idx && !forceLatch) {
      this.releaseLatch();
      return [];
    }

    // If another pad is latched, release it (exclusive lane latch)
    if (this.isLatchEnabled || forceLatch) {
      this.releaseLatch();
    }

    const midis = this.resolvePadMidis(idx);
    const voices = midis.map((m, i) =>
      this.engine.startVoice(m, this.preset, velocity - Math.min(i * 0.03, 0.18))
    );

    if (this.isLatchEnabled || forceLatch) {
      this.latchedSlot = idx;
      this.latchedVoices = voices;
    }

    if (pointerId !== null) {
      this.pointerHolds.set(pointerId, { slot: idx, voices });
    }

    this.notify();
    return voices;
  }

  releasePad(pointerId) {
    const hold = this.pointerHolds.get(pointerId);
    if (!hold) return;

    // If the released pad is NOT currently latched, naturally stop its voices
    if (this.latchedSlot !== hold.slot) {
      hold.voices.forEach(v => {
        try { v?.stop?.(); } catch {}
      });
    }

    this.pointerHolds.delete(pointerId);
    this.notify();
  }

  releaseLatch() {
    if (this.latchedVoices.length) {
      this.latchedVoices.forEach(v => {
        try { v?.stop?.(); } catch {}
      });
      this.latchedVoices = [];
    }
    this.latchedSlot = null;
    this.notify();
  }

  releaseAll() {
    this.pointerHolds.forEach(hold => {
      hold.voices.forEach(v => {
        try { v?.hardStop?.() || v?.stop?.(); } catch {}
      });
    });
    this.pointerHolds.clear();
    this.releaseLatch();
  }

  // --------------------------------------------------------------------------
  // Keyboard Geometry Model (Mathematical separation from DOM)
  // --------------------------------------------------------------------------

  getKeyboardLayoutModel() {
    const startMidi = noteMidi('C', this.octave);
    const totalNotes = this.displayedOctaves * 12;
    const midis = Array.from({ length: totalNotes + 1 }, (_, i) => startMidi + i);
    const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

    const whiteKeys = midis.filter(m => !isBlack(m)).map(m => ({
      midi: m,
      isBlack: false,
      label: m % 12 === 0 ? midiLabel(m) : ''
    }));

    const whiteCount = whiteKeys.length;
    const blackWidthPct = (100 / whiteCount) * 0.62;

    const blackKeys = midis.filter(isBlack).map(m => {
      const precedingWhites = whiteKeys.filter(w => w.midi < m).length;
      const leftPct = (precedingWhites / whiteCount) * 100;
      return {
        midi: m,
        isBlack: true,
        leftPct,
        widthPct: blackWidthPct
      };
    });

    return {
      displayedOctaves: this.displayedOctaves,
      whiteCount,
      whiteKeys,
      blackKeys
    };
  }

  // --------------------------------------------------------------------------
  // Serialization & Project Persistence (V39 Compatible)
  // --------------------------------------------------------------------------

  serializeState() {
    return {
      key: this.key,
      voicing: this.voicing,
      octave: this.octave,
      preset: this.preset,
      transpose: this.transpose,
      displayedOctaves: this.displayedOctaves,
      isLatchEnabled: this.isLatchEnabled,
      chords: JSON.parse(JSON.stringify(this.chords)),
      chordsCustomized: this.chordsCustomized
    };
  }

  restoreState(data) {
    if (!data) return;
    if (data.key && NOTES.includes(data.key)) this.key = data.key;
    if (data.voicing) this.voicing = data.voicing;
    if (Number.isFinite(data.octave)) this.octave = clamp(+data.octave, 1, 6);
    if (data.preset) this.preset = data.preset;
    if (Number.isFinite(data.transpose)) this.transpose = clamp(+data.transpose, -12, 12);
    if (Number.isFinite(data.displayedOctaves)) this.displayedOctaves = clamp(+data.displayedOctaves, 1, 3);
    if (typeof data.isLatchEnabled === 'boolean') this.isLatchEnabled = data.isLatchEnabled;
    if (Array.isArray(data.chords) && data.chords.length === 7) {
      this.chords = JSON.parse(JSON.stringify(data.chords));
      this.chordsCustomized = !!data.chordsCustomized;
    }
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
export const smartKeys = new SmartKeys();

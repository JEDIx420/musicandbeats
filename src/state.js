/**
 * Music & Beats — Canonical Application State & Constants (V39)
 *
 * Centralizes:
 * - Musical constants (notes, chromatic mapping, standard chord intervals)
 * - Synthesizer sound presets (multi-oscillator definitions, filter envelopes)
 * - Drum groove presets (Worship, Pop, Rock, Funk, House, Trap, Reggaeton, Lo-Fi, Keherwa, Dadra)
 * - Core workstation defaults & session state structures
 * - Immutable constants vs mutable user/session/runtime state
 */

// ============================================================================
// 1. IMMUTABLE MUSICAL CONSTANTS
// ============================================================================

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const FLAT_MAP = {
  'C#': 'C♯',
  'D#': 'D♯',
  'F#': 'F♯',
  'G#': 'G♯',
  'A#': 'A♯'
};

export const CHORD_FLAVORS = [
  ['triad', 'Triad'],
  ['6', '6th'],
  ['7', '7th'],
  ['maj7', 'Maj7'],
  ['m7', 'm7'],
  ['9', '9th'],
  ['maj9', 'Maj9'],
  ['m9', 'm9'],
  ['11', '11th'],
  ['13', '13th'],
  ['sus2', 'Sus2'],
  ['sus4', 'Sus4']
];

export const V6_CHORD_TYPES = [
  ['major', 'Major'], ['minor', 'Minor'], ['dim', 'Diminished'], ['aug', 'Augmented'],
  ['sus2', 'Sus2'], ['sus4', 'Sus4'], ['6', '6th'], ['m6', 'Minor 6'],
  ['7', 'Dominant 7'], ['maj7', 'Major 7'], ['m7', 'Minor 7'], ['dim7', 'Dim 7'],
  ['m7b5', 'm7♭5'], ['add9', 'Add 9'], ['9', 'Dominant 9'], ['maj9', 'Major 9'],
  ['m9', 'Minor 9'], ['11', '11th'], ['m11', 'Minor 11'], ['13', '13th'], ['m13', 'Minor 13']
];

export const V39_CHORD_INTERVALS = {
  'Major': [0, 4, 7],
  'Minor': [0, 3, 7],
  '7th': [0, 4, 7, 10],
  'Maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  'Dim': [0, 3, 6],
  'Aug': [0, 4, 8],
  'Sus2': [0, 2, 7],
  'Sus4': [0, 5, 7],
  '6th': [0, 4, 7, 9],
  'm6': [0, 3, 7, 9],
  '9th': [0, 4, 7, 10, 14],
  'Maj9': [0, 4, 7, 11, 14],
  'm9': [0, 3, 7, 10, 14],
  '11th': [0, 4, 7, 10, 14, 17],
  '13th': [0, 4, 7, 10, 14, 17, 21]
};

// ============================================================================
// 2. SYNTHESIZER & SOUND PRESETS (Cumulative through V17, V34, V37)
// ============================================================================

export const SOUND_PRESETS = {
  // Foundational Keys
  'Studio Grand': {
    oscs: [['triangle', 0, 0.72], ['sine', 12, 0.18], ['sine', 24, 0.05]],
    attack: 0.004, decay: 0.46, sustain: 0.32, release: 0.7, filter: 7600, q: 0.3, gain: 0.82
  },
  'Soft Grand': {
    oscs: [['triangle', 0, 0.76], ['sine', 12, 0.15]],
    attack: 0.01, decay: 0.72, sustain: 0.27, release: 1.0, filter: 4300, q: 0.25, gain: 0.78
  },
  'Velvet EP': {
    oscs: [['sine', 0, 0.68], ['triangle', 12, 0.2], ['sine', 24, 0.06]],
    attack: 0.008, decay: 0.25, sustain: 0.54, release: 1.05, filter: 5000, q: 0.4, gain: 0.83
  },
  'Wurli Drive': {
    oscs: [['triangle', 0, 0.58], ['square', 12, 0.13], ['sine', 24, 0.07]],
    attack: 0.006, decay: 0.2, sustain: 0.47, release: 0.62, filter: 3500, q: 0.7, gain: 0.72
  },
  'Tonewheel Organ': {
    oscs: [['sine', 0, 0.48], ['sine', 12, 0.24], ['sine', 19, 0.13], ['sine', 24, 0.08]],
    attack: 0.02, decay: 0.04, sustain: 0.88, release: 0.2, filter: 8500, q: 0.2, gain: 0.68
  },
  'Warm Analog': {
    oscs: [['sawtooth', 0, 0.46], ['triangle', -12, 0.2], ['sawtooth', 7, 0.14]],
    attack: 0.06, decay: 0.28, sustain: 0.58, release: 0.75, filter: 2900, q: 1.0, gain: 0.55
  },
  'Dream Pad': {
    oscs: [['triangle', 0, 0.42], ['sawtooth', 12, 0.18], ['sine', 7, 0.15]],
    attack: 0.42, decay: 0.5, sustain: 0.66, release: 2.0, filter: 3600, q: 0.5, gain: 0.5
  },
  'Air Choir': {
    oscs: [['sine', 0, 0.45], ['triangle', 7, 0.2], ['triangle', 12, 0.15]],
    attack: 0.34, decay: 0.36, sustain: 0.68, release: 1.6, filter: 4200, q: 0.4, gain: 0.5
  },
  'Glass Bell': {
    oscs: [['sine', 0, 0.55], ['sine', 19, 0.2], ['sine', 31, 0.1]],
    attack: 0.002, decay: 0.32, sustain: 0.16, release: 1.5, filter: 11000, q: 0.2, gain: 0.68
  },
  'Pluck': {
    oscs: [['triangle', 0, 0.6], ['sawtooth', 12, 0.13]],
    attack: 0.002, decay: 0.12, sustain: 0.08, release: 0.22, filter: 6200, q: 0.9, gain: 0.68
  },
  'Sub Bass': {
    oscs: [['sine', -12, 0.55], ['sawtooth', 0, 0.2], ['triangle', 12, 0.06]],
    attack: 0.006, decay: 0.14, sustain: 0.64, release: 0.24, filter: 1200, q: 1.1, gain: 0.7
  },
  'Neon Lead': {
    oscs: [['sawtooth', 0, 0.46], ['square', 12, 0.1], ['triangle', 7, 0.18]],
    attack: 0.012, decay: 0.16, sustain: 0.64, release: 0.34, filter: 4700, q: 1.3, gain: 0.56
  },

  // V17 Key Library
  'Neo Soul EP': {
    oscs: [['sine', 0, 0.58, -5], ['triangle', 12, 0.22, 7], ['sine', 19, 0.08, -3]],
    attack: 0.008, decay: 0.34, sustain: 0.52, release: 0.78, filter: 5200, q: 0.55, gain: 0.78,
    v17: { category: 'Electric Keys', filterEnv: 1.18 }
  },
  'Crystal House': {
    oscs: [['sine', 0, 0.48, 0], ['triangle', 12, 0.2, 8], ['sine', 24, 0.12, -7], ['sine', 31, 0.05, 4]],
    attack: 0.002, decay: 0.18, sustain: 0.28, release: 0.62, filter: 9200, q: 0.7, gain: 0.72,
    v17: { category: 'House Keys', filterEnv: 1.28 }
  },
  'Analog Poly': {
    oscs: [['sawtooth', 0, 0.36, -9], ['sawtooth', 0, 0.34, 9], ['triangle', -12, 0.16, 0]],
    attack: 0.028, decay: 0.28, sustain: 0.62, release: 0.7, filter: 3900, q: 1.15, gain: 0.55,
    v17: { category: 'Synth', filterEnv: 1.42 }
  },
  'Neon Supersaw': {
    oscs: [['sawtooth', 0, 0.24, -18], ['sawtooth', 0, 0.24, -9], ['sawtooth', 0, 0.24, 0],
           ['sawtooth', 0, 0.24, 9], ['sawtooth', 0, 0.24, 18], ['sine', -12, 0.08, 0]],
    attack: 0.012, decay: 0.2, sustain: 0.7, release: 0.54, filter: 7600, q: 0.8, gain: 0.43,
    v17: { category: 'EDM', filterEnv: 1.32 }
  },
  'Future Pluck': {
    oscs: [['triangle', 0, 0.48, -4], ['sawtooth', 12, 0.19, 6], ['sine', 24, 0.09, -2]],
    attack: 0.002, decay: 0.11, sustain: 0.07, release: 0.3, filter: 8700, q: 1.5, gain: 0.65,
    v17: { category: 'EDM', filterEnv: 1.65 }
  },
  'Festival Lead': {
    oscs: [['sawtooth', 0, 0.34, -10], ['sawtooth', 0, 0.34, 10], ['square', 12, 0.1, 0], ['sine', -12, 0.08, 0]],
    attack: 0.006, decay: 0.15, sustain: 0.72, release: 0.28, filter: 6900, q: 1.4, gain: 0.48,
    v17: { category: 'Lead', filterEnv: 1.3 }
  },
  'Vapor Pad': {
    oscs: [['triangle', 0, 0.32, -11], ['sawtooth', 12, 0.17, 12], ['sine', 7, 0.19, -5], ['sine', 19, 0.08, 6]],
    attack: 0.52, decay: 0.62, sustain: 0.72, release: 2.3, filter: 4300, q: 0.45, gain: 0.46,
    v17: { category: 'Pad', filterEnv: 1.08 }
  },
  'Trance Organ': {
    oscs: [['sine', 0, 0.35, 0], ['sine', 12, 0.25, 0], ['sine', 19, 0.16, 0], ['square', 24, 0.06, 0]],
    attack: 0.008, decay: 0.05, sustain: 0.86, release: 0.16, filter: 9800, q: 0.3, gain: 0.58,
    v17: { category: 'EDM', filterEnv: 1.0 }
  },
  'Digital Bell': {
    oscs: [['sine', 0, 0.46, 0], ['sine', 19, 0.18, 0], ['sine', 28, 0.12, 0], ['triangle', 36, 0.05, 0]],
    attack: 0.001, decay: 0.42, sustain: 0.09, release: 1.4, filter: 12000, q: 0.25, gain: 0.64,
    v17: { category: 'Mallet', filterEnv: 1.0 }
  },
  'Lo-Fi Keys': {
    oscs: [['triangle', 0, 0.47, -4], ['sine', 12, 0.18, 5], ['square', -12, 0.05, 0]],
    attack: 0.018, decay: 0.42, sustain: 0.46, release: 0.86, filter: 3300, q: 0.55, gain: 0.68,
    v17: { category: 'Texture', filterEnv: 1.05 }
  },

  // V17 Bass Library
  'Deep Club Sub': {
    oscs: [['sine', -12, 0.72, 0], ['triangle', 0, 0.13, 0]],
    attack: 0.003, decay: 0.16, sustain: 0.73, release: 0.2, filter: 780, q: 0.7, gain: 0.74,
    v17: { category: 'Sub', filterEnv: 1.12 }
  },
  'Reese Bass': {
    oscs: [['sawtooth', -12, 0.33, -14], ['sawtooth', -12, 0.33, 14], ['square', 0, 0.08, 0]],
    attack: 0.008, decay: 0.2, sustain: 0.68, release: 0.3, filter: 1650, q: 1.35, gain: 0.56,
    v17: { category: 'EDM Bass', filterEnv: 1.35 }
  },
  'Acid Bass': {
    oscs: [['sawtooth', -12, 0.45, 0], ['square', 0, 0.16, 5]],
    attack: 0.002, decay: 0.12, sustain: 0.44, release: 0.13, filter: 1450, q: 5.5, gain: 0.58,
    v17: { category: 'Acid', filterEnv: 2.4 }
  },
  'FM House Bass': {
    oscs: [['sine', -12, 0.55, 0], ['sine', 7, 0.15, 0], ['triangle', 12, 0.09, 0], ['square', 0, 0.06, 0]],
    attack: 0.002, decay: 0.18, sustain: 0.48, release: 0.2, filter: 2400, q: 1.1, gain: 0.7,
    v17: { category: 'House Bass', filterEnv: 1.45 }
  },
  'Pluck Bass': {
    oscs: [['triangle', -12, 0.5, 0], ['sawtooth', 0, 0.17, -5], ['sine', 12, 0.06, 0]],
    attack: 0.001, decay: 0.09, sustain: 0.08, release: 0.16, filter: 3100, q: 1.7, gain: 0.67,
    v17: { category: 'Pluck Bass', filterEnv: 1.9 }
  },
  'Future Growl': {
    oscs: [['sawtooth', -12, 0.29, -11], ['square', -12, 0.26, 12], ['sawtooth', 0, 0.13, 0], ['sine', -24, 0.18, 0]],
    attack: 0.006, decay: 0.19, sustain: 0.64, release: 0.3, filter: 2100, q: 2.2, gain: 0.52,
    v17: { category: 'EDM Bass', filterEnv: 1.55 }
  },

  // V34 Indian Acoustic Synths
  'Harmonium': {
    oscs: [['square', 0, 0.31], ['sine', 12, 0.26], ['square', 12, 0.08], ['sine', 19, 0.08]],
    attack: 0.025, decay: 0.12, sustain: 0.84, release: 0.24, filter: 4300, q: 0.8, gain: 0.58
  },
  'Tanpura Drone': {
    oscs: [['sawtooth', -12, 0.16], ['triangle', 0, 0.34], ['sine', 7, 0.22], ['sine', 12, 0.16]],
    attack: 0.11, decay: 0.2, sustain: 0.86, release: 1.35, filter: 3100, q: 0.9, gain: 0.46
  },
  'Bansuri Air': {
    oscs: [['sine', 0, 0.62], ['triangle', 12, 0.12], ['sine', 19, 0.05]],
    attack: 0.075, decay: 0.14, sustain: 0.72, release: 0.55, filter: 5100, q: 0.55, gain: 0.56
  },
  'Sitar Pluck': {
    oscs: [['sawtooth', 0, 0.18], ['triangle', 12, 0.34], ['sine', 24, 0.12], ['sine', 31, 0.05]],
    attack: 0.002, decay: 0.16, sustain: 0.10, release: 0.42, filter: 6700, q: 1.8, gain: 0.62
  },

  // V37 / V38 Leads
  'Bansuri Lead': {
    oscs: [['sine', 0, 0.72], ['triangle', 12, 0.13], ['sine', 19, 0.04]],
    attack: 0.035, decay: 0.12, sustain: 0.82, release: 0.20, filter: 7600, q: 0.8, gain: 0.63
  },
  'Sitar Lead': {
    oscs: [['sawtooth', 0, 0.20], ['triangle', 12, 0.38], ['sine', 24, 0.10], ['sine', 31, 0.04]],
    attack: 0.002, decay: 0.12, sustain: 0.34, release: 0.24, filter: 8500, q: 2.1, gain: 0.66
  },
  'Fusion Lead': {
    oscs: [['sawtooth', 0, 0.28], ['square', 12, 0.08], ['sine', 12, 0.18]],
    attack: 0.008, decay: 0.10, sustain: 0.70, release: 0.18, filter: 6900, q: 1.0, gain: 0.56
  },
  'Glass Lead': {
    oscs: [['triangle', 0, 0.48], ['sine', 12, 0.30], ['sine', 24, 0.08]],
    attack: 0.012, decay: 0.16, sustain: 0.68, release: 0.34, filter: 9200, q: 0.55, gain: 0.58
  }
};

// ============================================================================
// 3. BEAT & GROOVE PRESETS
// ============================================================================

export const BEAT_PRESETS = {
  Worship: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  Pop: { kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  Rock: { kick: [0, 3, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  Funk: { kick: [0, 3, 7, 10, 14], snare: [4, 12, 15], hat: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14] },
  House: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  Trap: { kick: [0, 7, 10, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 9, 10, 11, 12, 14, 15] },
  Reggaeton: { kick: [0, 3, 8, 11], snare: [4, 7, 12, 15], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  'Lo-Fi': { kick: [0, 7, 10], snare: [4, 12], hat: [0, 3, 6, 9, 12, 15] },
  Keherwa: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  Dadra: { kick: [0, 6, 12], snare: [3, 9, 15], hat: [0, 3, 6, 9, 12, 15] }
};

// ============================================================================
// 4. STORAGE KEYS & NAMESPACES
// ============================================================================

export const STORAGE_KEYS = {
  IDB_NAME: 'musicandbeats-v3',
  LOOPER: 'musicandbeats:v34:looper',
  SETTINGS: 'musicandbeats:v35:settings',
  PROJECTS: 'musicandbeats:v35:projects',
  AUTOSAVE: 'musicandbeats:v35:autosave',
  LATCH_SMART: 'musicandbeats:v18:latch:smart',
  LATCH_BASS: 'musicandbeats:v18:latch:bass',
  PLAY_BEAT: 'musicandbeats:v18:playbeat',
  DISPLAYED_OCTAVES: 'musicandbeats:v33:displayed-octaves',
  V37_SETTINGS: 'musicandbeats:v37:settings',
  V38_SETTINGS: 'musicandbeats:v38:settings',
  V39_SETTINGS: 'musicandbeats:v39:settings'
};

// ============================================================================
// 5. CANONICAL RUNTIME MUTABLE STATE (Default Snapshot)
// ============================================================================

export function createEmptyPattern() {
  return {
    kick: new Array(16).fill(false),
    snare: new Array(16).fill(false),
    hat: new Array(16).fill(false)
  };
}

export function createDefaultSession(layerCount = 4) {
  return {
    bpm: 100,
    bars: 4,
    countIn: 1,
    layerCount,
    current: 0,
    layers: []
  };
}

export const appState = {
  // Navigation & UI
  currentScreen: 'home',
  
  // Audio Transport & Engine
  audioReady: false,
  bpm: 100,
  metronome: false,
  transportRunning: false,
  sessionPlaying: false,
  recordBusy: false,

  // Performance Instruments
  activeInstrument: 'chords', // 'chords' | 'guitar' | 'bass' | 'lead'
  keyPreset: 'C',
  voicing: 'close',
  octave: 3,
  sound: 'Studio Grand',
  displayedOctaves: 2,

  // Latch States
  latch: {
    smart: false,
    bass: false
  },

  // Transpose Values (V39)
  transpose: {
    keys: 0,
    bass: 0
  },

  // Expression (V4 / V17)
  expression: {
    velocity: 0.86,
    sustain: 0.80,
    tone: 7000,
    space: 0.18
  },

  // Backing Multi-Track Mixer (V37)
  mix: {
    beats: 0.86,
    keys: 0.80,
    bass: 0.84,
    lead: 1.10
  }
};

// ============================================================================
// 6. HELPER FUNCTIONS
// ============================================================================

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function noteMidi(note, octave) {
  return (octave + 1) * 12 + NOTES.indexOf(note);
}

export function midiLabel(m) {
  const n = NOTES[((m % 12) + 12) % 12];
  return `${FLAT_MAP[n] || n}${Math.floor(m / 12) - 1}`;
}

export function barSeconds(bars, bpm) {
  return (bars * 4 * 60) / bpm;
}

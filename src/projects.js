/**
 * Music & Beats — Canonical Project Persistence & Multi-Generation Adapters (V39)
 *
 * Consolidates:
 * - Backwards-compatible project serialization & loading across all historical schemas
 * - Compatibility Adapters for:
 *     - V3 Base project schema (IndexedDB / localStorage)
 *     - V34 Looper namespace (`musicandbeats:v34:looper`)
 *     - V35 / V36 Core snapshots (`musicandbeats:v35:projects`, `musicandbeats:v35:settings`, `musicandbeats:v35:autosave`)
 *     - V37 Multi-track mixer snapshots (`musicandbeats:v37:settings`)
 *     - V38 Lead performance & deep FX settings (`musicandbeats:v38:settings`)
 *     - V39 Extended custom chords, Keys transpose, Bass transpose, and performance strips
 * - Non-destructive storage: reads legacy schemas, normalizes in-memory, saves without overwriting older namespaces
 * - Clean async APIs: listProjects, loadProject, saveProject, deleteProject, createNewProject
 */

import { STORAGE_KEYS, clamp, NOTES } from './state.js';
import { liveLooper } from './looper.js';
import { grooveBox } from './groove-box.js';
import { smartKeys } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { leadInstrument } from './instruments/lead.js';
import { arpEngine } from './arp-engine.js';

export class ProjectManager {
  constructor() {
    this.currentProjectId = null;
    this.currentProjectName = 'Untitled Jam';
    this.listeners = new Set();
  }

  // ==========================================================================
  // 1. CANONICAL PROJECT MODEL
  // ==========================================================================

  createCanonicalSnapshot(name = this.currentProjectName) {
    const now = new Date().toISOString();
    return {
      schemaVersion: 'v39',
      id: this.currentProjectId || `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: (name || 'Untitled Jam').trim(),
      updatedAt: now,

      // Looper & Session
      session: {
        bpm: 100,
        bars: 4,
        activeLane: 'beats',
        tracks: {
          beats: { muted: false, level: 0.86 },
          keys:  { muted: false, level: 0.80, events: [], sound: 'Studio Grand', key: 'C' },
          bass:  { muted: false, level: 0.84, events: [], sound: 'Sub Bass', key: 'C' },
          lead:  { muted: false, level: 1.10 }
        }
      },

      // Groove Box
      groove: {
        style: 'Worship',
        energy: 3,
        muted: false,
        pattern: { kick: new Array(16).fill(false), snare: new Array(16).fill(false), hat: new Array(16).fill(false) }
      },

      // Smart Keys
      smartKeys: {
        key: 'C',
        voicing: 'close',
        octave: 3,
        preset: 'Studio Grand',
        transpose: 0,
        displayedOctaves: 2,
        isLatchEnabled: false,
        chords: [],
        chordsCustomized: false
      },

      // Bass
      bass: {
        preset: 'Sub Bass',
        key: 'C',
        octave: 2,
        transpose: 0,
        isLatchEnabled: false
      },

      // Lead Instrument
      lead: {
        layout: 'Piano',
        startOctave: 4,
        displayOctaves: 2,
        voice: 'Grand Piano',
        slide: true,
        glideMs: 85,
        pitchRange: 2,
        mod: 0
      },

      // Arpeggiator
      arp: {
        enabled: false,
        target: 'keys',
        pattern: 'up',
        rate: '1/16',
        octaves: 1,
        preset: 'Studio Grand',
        gate: 0.75
      }
    };
  }

  // ==========================================================================
  // 2. MULTI-GENERATION COMPATIBILITY ADAPTERS
  // ==========================================================================

  /**
   * Normalizes any historical project data object into the canonical V39 model.
   */
  normalizeProject(raw) {
    if (!raw) return this.createCanonicalSnapshot('New Jam');

    // Default V39 baseline
    const canonical = this.createCanonicalSnapshot(raw.name || raw.looper?.name || 'Untitled Jam');
    canonical.id = raw.id || canonical.id;
    if (raw.updatedAt) canonical.updatedAt = raw.updatedAt;

    // --- Adapter 1: V34/V35 Looper Structure ---
    const loopSrc = raw.looper || raw;
    if (loopSrc) {
      if (Number.isFinite(loopSrc.bpm)) canonical.session.bpm = clamp(+loopSrc.bpm, 40, 220);
      if (loopSrc.bars) canonical.session.bars = loopSrc.bars;
      if (loopSrc.activeLane) canonical.session.activeLane = loopSrc.activeLane;

      if (loopSrc.beatStyle) canonical.groove.style = loopSrc.beatStyle;
      if (Number.isFinite(loopSrc.energy)) canonical.groove.energy = clamp(+loopSrc.energy, 1, 5);
      if (loopSrc.beatPattern?.kick) canonical.groove.pattern = loopSrc.beatPattern;

      if (loopSrc.keys) {
        canonical.session.tracks.keys.muted = !!loopSrc.keys.muted;
        if (loopSrc.keys.sound) canonical.session.tracks.keys.sound = loopSrc.keys.sound;
        if (loopSrc.keys.key) canonical.session.tracks.keys.key = loopSrc.keys.key;
        if (Array.isArray(loopSrc.keys.events)) canonical.session.tracks.keys.events = [...loopSrc.keys.events];
      }

      if (loopSrc.bass) {
        canonical.session.tracks.bass.muted = !!loopSrc.bass.muted;
        if (loopSrc.bass.sound) canonical.session.tracks.bass.sound = loopSrc.bass.sound;
        if (loopSrc.bass.key) canonical.session.tracks.bass.key = loopSrc.bass.key;
        if (Array.isArray(loopSrc.bass.events)) canonical.session.tracks.bass.events = [...loopSrc.bass.events];
      }
    }

    // --- Adapter 2: V37 Mixer Snapshot ---
    if (raw.mix || raw.looper?.mix) {
      const m = raw.mix || raw.looper.mix;
      if (Number.isFinite(m.beats)) canonical.session.tracks.beats.level = m.beats;
      if (Number.isFinite(m.keys)) canonical.session.tracks.keys.level = m.keys;
      if (Number.isFinite(m.bass)) canonical.session.tracks.bass.level = m.bass;
      if (Number.isFinite(m.lead)) canonical.session.tracks.lead.level = m.lead;
    }

    // --- Adapter 3: V38 Lead Snapshot ---
    if (raw.lead || raw.v38) {
      const l = raw.lead || raw.v38;
      if (l.voice) canonical.lead.voice = l.voice;
      if (l.layout) canonical.lead.layout = l.layout;
      if (Number.isFinite(l.startOctave)) canonical.lead.startOctave = l.startOctave;
      if (Number.isFinite(l.displayOctaves)) canonical.lead.displayOctaves = l.displayOctaves;
    }

    // --- Adapter 4: V39 Extended Settings (Chords, Transpose, Performance Strips) ---
    const v39Src = raw.v39 || raw.data?.v39 || raw;
    if (v39Src) {
      if (v39Src.transpose) {
        canonical.smartKeys.transpose = clamp(+v39Src.transpose.keys || 0, -12, 12);
        canonical.bass.transpose = clamp(+v39Src.transpose.bass || 0, -12, 12);
      }
      if (Array.isArray(v39Src.chords) && v39Src.chords.length === 7) {
        canonical.smartKeys.chords = [...v39Src.chords];
        canonical.smartKeys.chordsCustomized = !!v39Src.chordsCustomized;
      }
      if (typeof v39Src.slide === 'boolean') canonical.lead.slide = v39Src.slide;
      if (Number.isFinite(v39Src.glideMs)) canonical.lead.glideMs = clamp(+v39Src.glideMs, 0, 300);
      if (Number.isFinite(v39Src.pitchRange)) canonical.lead.pitchRange = v39Src.pitchRange;
      if (Number.isFinite(v39Src.mod)) canonical.lead.mod = clamp(+v39Src.mod, 0, 1);
    }

    return canonical;
  }

  // ==========================================================================
  // 3. STORAGE I/O & PROJECT LIFECYCLE
  // ==========================================================================

  getStoredProjects() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  putStoredProjects(list) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(list));
    } catch (err) {
      console.warn('Could not persist project list to localStorage', err);
    }
  }

  listProjects() {
    return this.getStoredProjects().map(item => ({
      id: item.id,
      name: item.name || 'Untitled Jam',
      updatedAt: item.updatedAt || item.createdAt || ''
    }));
  }

  saveProject(name = null, forceNew = false) {
    const list = this.getStoredProjects();
    const finalName = (name || this.currentProjectName || 'Untitled Jam').trim();

    let targetItem = !forceNew && this.currentProjectId
      ? list.find(p => p.id === this.currentProjectId)
      : null;

    const snapshot = this.createCanonicalSnapshot(finalName);

    if (!targetItem) {
      targetItem = {
        id: snapshot.id,
        name: finalName,
        createdAt: snapshot.updatedAt,
        updatedAt: snapshot.updatedAt,
        data: snapshot
      };
      list.unshift(targetItem);
    } else {
      targetItem.name = finalName;
      targetItem.updatedAt = snapshot.updatedAt;
      targetItem.data = snapshot;
    }

    this.currentProjectId = targetItem.id;
    this.currentProjectName = finalName;
    this.putStoredProjects(list);
    this.notify();
    return targetItem;
  }

  loadProject(id) {
    const list = this.getStoredProjects();
    const item = list.find(p => p.id === id);
    if (!item) return null;

    const canonical = this.normalizeProject(item.data || item);
    this.applyProjectToRuntime(canonical);

    this.currentProjectId = item.id;
    this.currentProjectName = item.name;
    this.notify();
    return canonical;
  }

  deleteProject(id) {
    const list = this.getStoredProjects().filter(p => p.id !== id);
    this.putStoredProjects(list);

    if (this.currentProjectId === id) {
      this.currentProjectId = null;
      this.currentProjectName = 'Untitled Jam';
    }
    this.notify();
  }

  createNewProject() {
    liveLooper.resetTransport();
    smartKeys.resetAllChords();
    smartKeys.setTranspose(0);
    bassInstrument.setTranspose(0);
    leadInstrument.stopAll();

    this.currentProjectId = null;
    this.currentProjectName = 'Untitled Jam';

    const clean = this.createCanonicalSnapshot(this.currentProjectName);
    this.applyProjectToRuntime(clean);
    this.notify();
    return clean;
  }

  applyProjectToRuntime(canonical) {
    liveLooper.restoreSession(canonical.session);
    grooveBox.restoreState(canonical.groove);
    smartKeys.restoreState(canonical.smartKeys);
    bassInstrument.restoreState(canonical.bass);
    leadInstrument.restoreState(canonical.lead);
    arpEngine.restoreState(canonical.arp);
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
export const projectManager = new ProjectManager();

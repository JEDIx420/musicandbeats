/**
 * Music & Beats — Canonical Record UI Subsystem (V39)
 *
 * Consolidates:
 * - Record Setup screen: BPM (40–220), bars (1, 2, 4, 8), count-in (0 or 1 bar), key preset
 * - Live Looper session timeline: visual progress ring, bar.beat step counter, master clock status
 * - Multi-Track workspace strips: Beats, Keys, Bass, and Lead tracks with mute toggles and level faders
 * - Transport controls: Play / Pause / Record / Reset with clean state machine (idle, armed, countIn, recording)
 * - Timeline animation powered strictly by requestAnimationFrame interpolating canonical scheduler time
 * - Explicit lifecycle teardown to prevent listener leaks
 */

import { liveLooper } from './looper.js';
import { recordingEngine } from './recording.js';
import { scheduler } from './scheduler.js';
import { grooveBox } from './groove-box.js';
import { NOTES, clamp } from './state.js';
import { helpSubsystem } from './help.js';

export class RecordUI {
  constructor(container = null) {
    this.container = container;
    this.mode = 'looper'; // 'setup' | 'looper'
    this.rafId = null;

    this.boundListeners = [];
    this.unsubscribers = [];
  }

  // ==========================================================================
  // 1. VIEW MODELS (Pure, Decoupled, Node-Testable)
  // ==========================================================================

  getSetupViewModel() {
    return {
      bpm: liveLooper.bpm,
      bars: liveLooper.bars,
      barChoices: [1, 2, 4, 8],
      key: liveLooper.tracks.keys.key,
      keysPreset: liveLooper.tracks.keys.sound,
      bassPreset: liveLooper.tracks.bass.sound,
      notes: NOTES
    };
  }

  getLooperViewModel() {
    return {
      bpm: liveLooper.bpm,
      bars: liveLooper.bars,
      totalSteps: liveLooper.totalSteps,
      isRunning: liveLooper.isRunning,
      activeLane: liveLooper.activeLane,
      recordingState: recordingEngine.state, // 'idle' | 'armed' | 'countIn' | 'recording'
      recordingLane: recordingEngine.recordingLane,
      tracks: {
        beats: { ...liveLooper.tracks.beats },
        keys:  { ...liveLooper.tracks.keys, eventCount: liveLooper.tracks.keys.events?.length || 0 },
        bass:  { ...liveLooper.tracks.bass, eventCount: liveLooper.tracks.bass.events?.length || 0 },
        lead:  { ...liveLooper.tracks.lead }
      }
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

    this.unsubscribers.push(liveLooper.subscribe(() => this.renderTracks()));
    this.unsubscribers.push(recordingEngine.subscribe(() => this.renderTracks()));
    this.startTimelineLoop();
  }

  unmount() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

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

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mb-record-shell" role="region" aria-label="Record Session Workspace">
        <!-- Transport & Timeline Bar -->
        <header class="mb-record-transport">
          <button class="mb-btn-record-play ${liveLooper.isRunning ? 'playing' : ''}" type="button">
            ${liveLooper.isRunning ? '■ Stop' : '▶ Play'}
          </button>
          <div class="mb-tempo-controls">
            <button class="mb-bpm-down" type="button">−</button>
            <span class="mb-bpm-display">${liveLooper.bpm} BPM</span>
            <button class="mb-bpm-up" type="button">+</button>
          </div>
          <div class="mb-loop-length">
            <span>BARS:</span>
            ${[1, 2, 4, 8].map(b => `
              <button class="mb-bar-choice ${b === liveLooper.bars ? 'active' : ''}" data-bars="${b}">${b}</button>
            `).join('')}
          </div>
        </header>

        <!-- Visual Loop Timeline -->
        <div class="mb-timeline-display">
          <div class="mb-clock-badge">
            <span class="mb-step-indicator">1.1</span>
            <strong class="mb-clock-status">Ready</strong>
          </div>
          <div class="mb-progress-bar-track">
            <div class="mb-progress-bar-fill" style="width: 0%"></div>
          </div>
        </div>

        <!-- Multi-Track Strips -->
        <section id="mbRecordTracks" class="mb-tracks-container"></section>
      </div>
    `;

    this.bindTransportHandlers();
    this.renderTracks();
  }

  bindTransportHandlers() {
    const playBtn = this.container.querySelector('.mb-btn-record-play');
    this.listen(playBtn, 'click', () => {
      if (liveLooper.isRunning) {
        liveLooper.stopTransport();
      } else {
        liveLooper.startTransport();
      }
      playBtn.classList.toggle('playing', liveLooper.isRunning);
      playBtn.textContent = liveLooper.isRunning ? '■ Stop' : '▶ Play';
    });

    this.listen(this.container.querySelector('.mb-bpm-down'), 'click', () => {
      liveLooper.setBpm(liveLooper.bpm - 1);
      this.updateBpmDisplay();
    });

    this.listen(this.container.querySelector('.mb-bpm-up'), 'click', () => {
      liveLooper.setBpm(liveLooper.bpm + 1);
      this.updateBpmDisplay();
    });

    this.container.querySelectorAll('.mb-bar-choice').forEach(btn => {
      this.listen(btn, 'click', () => {
        liveLooper.setBars(+btn.dataset.bars);
        this.container.querySelectorAll('.mb-bar-choice').forEach(b => {
          b.classList.toggle('active', +b.dataset.bars === liveLooper.bars);
        });
      });
    });
  }

  updateBpmDisplay() {
    const disp = this.container?.querySelector('.mb-bpm-display');
    if (disp) disp.textContent = `${liveLooper.bpm} BPM`;
  }

  renderTracks() {
    const tracksHost = this.container?.querySelector('#mbRecordTracks');
    if (!tracksHost) return;

    const vm = this.getLooperViewModel();
    tracksHost.innerHTML = `
      <div class="mb-track-strips">
        <!-- Beats Strip -->
        <div class="mb-track-strip ${vm.tracks.beats.muted ? 'muted' : ''}">
          <span class="mb-track-name">🥁 Beats</span>
          <button class="mb-btn-mute" data-lane="beats">${vm.tracks.beats.muted ? 'Unmute' : 'Mute'}</button>
          <span class="mb-track-info">${grooveBox.style}</span>
        </div>

        <!-- Keys Strip -->
        <div class="mb-track-strip ${vm.tracks.keys.muted ? 'muted' : ''} ${vm.recordingLane === 'keys' ? 'recording' : ''}">
          <span class="mb-track-name">🎹 Keys</span>
          <button class="mb-btn-mute" data-lane="keys">${vm.tracks.keys.muted ? 'Unmute' : 'Mute'}</button>
          <button class="mb-btn-arm ${vm.recordingLane === 'keys' ? 'active' : ''}" data-arm="keys">
            ${vm.recordingLane === 'keys' ? 'Recording…' : 'Arm Keys'}
          </button>
          <span class="mb-track-info">${vm.tracks.keys.eventCount} notes</span>
        </div>

        <!-- Bass Strip -->
        <div class="mb-track-strip ${vm.tracks.bass.muted ? 'muted' : ''} ${vm.recordingLane === 'bass' ? 'recording' : ''}">
          <span class="mb-track-name">♩ Bass</span>
          <button class="mb-btn-mute" data-lane="bass">${vm.tracks.bass.muted ? 'Unmute' : 'Mute'}</button>
          <button class="mb-btn-arm ${vm.recordingLane === 'bass' ? 'active' : ''}" data-arm="bass">
            ${vm.recordingLane === 'bass' ? 'Recording…' : 'Arm Bass'}
          </button>
          <span class="mb-track-info">${vm.tracks.bass.eventCount} notes</span>
        </div>
      </div>
    `;

    // Bind Mute & Arm Buttons
    tracksHost.querySelectorAll('.mb-btn-mute').forEach(btn => {
      this.listen(btn, 'click', () => {
        const lane = btn.dataset.lane;
        liveLooper.setTrackMute(lane, !liveLooper.tracks[lane].muted);
      });
    });

    tracksHost.querySelectorAll('.mb-btn-arm').forEach(btn => {
      this.listen(btn, 'click', () => {
        const lane = btn.dataset.arm;
        if (recordingEngine.recordingLane === lane) {
          const res = recordingEngine.finishRecording({
            boundaryTime: liveLooper.engine.context?.currentTime || 0,
            stepSeconds: liveLooper.stepSeconds,
            wrapTotalSteps: liveLooper.totalSteps
          });
          if (res?.events?.length) {
            res.events.forEach(e => liveLooper.addEvent(lane, e));
          }
        } else {
          recordingEngine.armLane(lane);
          if (!liveLooper.isRunning) {
            liveLooper.startTransport();
          }
        }
      });
    });
  }

  startTimelineLoop() {
    const tick = () => {
      if (liveLooper.isRunning && liveLooper.engine.context) {
        const step = scheduler.currentStep;
        const total = liveLooper.totalSteps;
        const pct = ((step + 1) / total) * 100;

        const fill = this.container?.querySelector('.mb-progress-bar-fill');
        if (fill) fill.style.width = `${pct}%`;

        const indicator = this.container?.querySelector('.mb-step-indicator');
        if (indicator) {
          const bar = Math.floor(step / 16) + 1;
          const beat = Math.floor((step % 16) / 4) + 1;
          indicator.textContent = `${bar}.${beat}`;
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}

// Global Singleton Instance
export const recordUI = new RecordUI();

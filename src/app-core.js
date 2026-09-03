/**
 * Music & Beats — Canonical Application Core & Lifecycle Coordinator (V39)
 *
 * Consolidates:
 * - Application bootstrapping and top-level DOM mounting
 * - Screen router: Home, Play, and Record workspaces
 * - Global pointer/touch hardening:
 *     - Only suppresses touch scrolling on explicit musical controls (.mb-key, .mb-perf-strip, .mb-chord-pad)
 *     - Leaves standard buttons, select inputs, sliders, and modals freely scrollable
 * - Unified AudioContext unlocking on user gesture
 * - Global Panic & Teardown:
 *     - Cancels active voices, latches, and pending async Lead sample promises
 *     - Cleans up AudioWorklet recording, resets looper transport, and flushes ARP schedules
 * - Lifecycle management (visibilitychange, tab hiding, browser unmount) with zero listener accumulation
 */

import { audioEngine } from './audio-engine.js';
import { scheduler } from './scheduler.js';
import { liveLooper } from './looper.js';
import { playUI } from './play-ui.js';
import { recordUI } from './record-ui.js';
import { helpSubsystem } from './help.js';
import { smartKeys } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { guitarRig } from './instruments/guitar.js';
import { leadInstrument } from './instruments/lead.js';
import { arpEngine } from './arp-engine.js';
import { projectManager } from './projects.js';

export class AppCore {
  constructor() {
    this.root = null;
    this.currentScreen = 'home'; // 'home' | 'play' | 'record'
    this.isMounted = false;

    this.boundGlobalListeners = [];
  }

  // ==========================================================================
  // 1. INITIALIZATION & MOUNT
  // ==========================================================================

  initialize(rootElement) {
    if (!rootElement) return;
    this.destroy(); // Ensure idempotent clean start

    this.root = rootElement;
    this.isMounted = true;

    this.installGlobalEventHardening();
    this.renderShell();
    this.navigateTo(this.currentScreen);
  }

  destroy() {
    if (!this.isMounted) return;

    this.panic();

    // Teardown screen UIs
    playUI.unmount();
    recordUI.unmount();
    helpSubsystem.closeModal();

    // Remove global listeners
    this.boundGlobalListeners.forEach(({ target, event, handler, options }) => {
      try { target.removeEventListener(event, handler, options); } catch {}
    });
    this.boundGlobalListeners = [];

    if (this.root) {
      this.root.innerHTML = '';
      this.root = null;
    }

    this.isMounted = false;
  }

  // ==========================================================================
  // 2. GLOBAL POINTER & TOUCH HARDENING
  // ==========================================================================

  installGlobalEventHardening() {
    if (typeof window === 'undefined') return;

    // Helper to register and track global listener
    const addGlobal = (target, event, handler, options = false) => {
      target.addEventListener(event, handler, options);
      this.boundGlobalListeners.push({ target, event, handler, options });
    };

    // 1. Touch behavior: prevent default ONLY on dedicated musical performance surfaces
    const onTouchMove = (e) => {
      if (e.target.closest('.mb-chord-pad, .mb-key, .mb-perf-strip, .mb-bass-pad')) {
        e.preventDefault();
      }
    };
    addGlobal(document, 'touchmove', onTouchMove, { passive: false });

    // 2. Visibility change: pause/mute background audio if tab is hidden
    const onVisibilityChange = () => {
      if (document.hidden) {
        this.panic();
      }
    };
    addGlobal(document, 'visibilitychange', onVisibilityChange);

    // 3. Audio unlock on first user gesture
    const unlockAudio = () => {
      audioEngine.primeAudio();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    addGlobal(window, 'pointerdown', unlockAudio, { passive: true });
    addGlobal(window, 'keydown', unlockAudio, { passive: true });
  }

  // ==========================================================================
  // 3. TOP-LEVEL SHELL & NAVIGATION
  // ==========================================================================

  renderShell() {
    if (!this.root) return;

    this.root.innerHTML = `
      <div class="mb-app-shell">
        <header class="mb-navbar" role="banner">
          <button class="mb-brand-btn" type="button">
            <strong>Music & Beats</strong>
          </button>
          <div class="mb-nav-actions">
            <button class="mb-nav-btn ${this.currentScreen === 'play' ? 'active' : ''}" data-screen="play">Play</button>
            <button class="mb-nav-btn ${this.currentScreen === 'record' ? 'active' : ''}" data-screen="record">Record</button>
            <button class="mb-nav-btn mb-btn-explain" type="button">❓ Explain</button>
            <button class="mb-nav-btn mb-btn-panic" type="button" aria-label="Stop all audio">🛑 Panic</button>
          </div>
        </header>

        <main id="mbScreenStage" class="mb-screen-stage" role="main"></main>
      </div>
    `;

    // Bind Navigation Bar
    const nav = this.root.querySelector('.mb-navbar');
    if (nav) {
      nav.addEventListener('click', (e) => {
        const screenBtn = e.target.closest('[data-screen]');
        if (screenBtn) {
          this.navigateTo(screenBtn.dataset.screen);
          return;
        }
        if (e.target.closest('.mb-brand-btn')) {
          this.navigateTo('home');
          return;
        }
        if (e.target.closest('.mb-btn-panic')) {
          this.panic();
          return;
        }
        if (e.target.closest('.mb-btn-explain')) {
          const active = helpSubsystem.toggleExplainMode();
          e.target.closest('.mb-btn-explain').classList.toggle('active', active);
          return;
        }
      });
    }
  }

  navigateTo(screenName) {
    if (!['home', 'play', 'record'].includes(screenName)) return;

    this.panic(); // Silence prior audio when switching workflows
    this.currentScreen = screenName;

    // Update active nav buttons
    this.root?.querySelectorAll('[data-screen]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === this.currentScreen);
    });

    const stage = this.root?.querySelector('#mbScreenStage');
    if (!stage) return;

    if (screenName === 'home') {
      playUI.unmount();
      recordUI.unmount();
      stage.innerHTML = `
        <div class="mb-home-view">
          <span class="mb-kicker">MOBILE LOOP WORKSTATION</span>
          <h1>Build a backing track.<br><span>Play over it.</span></h1>
          <p>Beats, chords and bass — one synced loop, without a complex recording workflow.</p>
          <div class="mb-home-actions">
            <button class="mb-btn-action v34-accent" data-goto="play">▶ Play Jam</button>
            <button class="mb-btn-action" data-goto="record">⏺ Record Loop</button>
          </div>
        </div>
      `;
      stage.querySelector('[data-goto="play"]')?.addEventListener('click', () => this.navigateTo('play'));
      stage.querySelector('[data-goto="record"]')?.addEventListener('click', () => this.navigateTo('record'));
    } else if (screenName === 'play') {
      recordUI.unmount();
      playUI.mount(stage);
    } else if (screenName === 'record') {
      playUI.unmount();
      recordUI.mount(stage);
    }
  }

  // ==========================================================================
  // 4. PANIC & COMPLETE RUNTIME SAFETY
  // ==========================================================================

  panic() {
    audioEngine.panic();
    smartKeys.releaseAll();
    bassInstrument.hardStopAll();
    leadInstrument.stopAll();
    arpEngine.stop();
    liveLooper.stopTransport();
  }
}

// Global Singleton Instance
export const appCore = new AppCore();

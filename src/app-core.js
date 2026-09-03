/**
 * Music & Beats — Canonical Application Core & Lifecycle Coordinator (Play-First)
 *
 * Consolidates:
 * - Play-First single product experience: boots directly to Play jam mode
 * - Polished header with brand, Play status badge, Explain Controls, and Panic
 * - Global pointer/touch hardening:
 *     - Suppresses touch scrolling only on musical controls (.mb-key, .mb-chord-pad, .mb-bass-pad, .mb-perf-strip)
 *     - Selects, buttons, sliders, and modals scroll smoothly
 * - Unified AudioContext unlocking on first user interaction
 * - Global Panic & Teardown
 */

import { audioEngine } from './audio-engine.js';
import { playUI } from './play-ui.js';
import { helpSubsystem } from './help.js';
import { smartKeys } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { guitarRig } from './instruments/guitar.js';
import { leadInstrument } from './instruments/lead.js';
import { arpEngine } from './arp-engine.js';
import { grooveBox } from './groove-box.js';
import { scheduler } from './scheduler.js';

export class AppCore {
  constructor() {
    this.root = null;
    this.currentScreen = 'play'; // Play-first main product
    this.isMounted = false;

    this.boundGlobalListeners = [];
  }

  // ==========================================================================
  // 1. INITIALIZATION & MOUNT
  // ==========================================================================

  initialize(rootElement) {
    if (!rootElement) return;
    this.destroy();

    this.root = rootElement;
    this.isMounted = true;

    this.installGlobalEventHardening();
    this.renderShell();
    this.mountPlayWorkspace();
  }

  destroy() {
    if (!this.isMounted) return;

    this.panic();

    playUI.unmount();
    helpSubsystem.closeModal();

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

    const addGlobal = (target, event, handler, options = false) => {
      target.addEventListener(event, handler, options);
      this.boundGlobalListeners.push({ target, event, handler, options });
    };

    // 1. Touch behavior: prevent default ONLY on dedicated performance controls
    const onTouchMove = (e) => {
      if (e.target.closest('.mb-chord-pad, .mb-key, .mb-perf-strip, .mb-bass-pad, .mb-seq-step')) {
        e.preventDefault();
      }
    };
    addGlobal(document, 'touchmove', onTouchMove, { passive: false });

    // 2. Visibility change: stop audio when tab is backgrounded
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
  // 3. TOP-LEVEL SHELL & PLAY-FIRST MOUNT
  // ==========================================================================

  renderShell() {
    if (!this.root) return;

    this.root.innerHTML = `
      <div class="mb-app-shell">
        <header class="mb-navbar" role="banner">
          <div class="mb-brand-block">
            <span class="mb-brand-mark"><i></i><i></i><i></i><i></i></span>
            <div class="mb-brand-text">
              <small class="mb-brand-kicker">JAM WORKSTATION</small>
              <strong class="mb-brand-name">Music &amp; Beats</strong>
            </div>
          </div>
          <div class="mb-nav-actions">
            <span id="mbAudioBadge" class="mb-audio-pill"><span></span>Audio Ready</span>
            <button class="mb-nav-btn mb-btn-explain" type="button" aria-label="Toggle Explain Controls">❓ Explain</button>
            <button class="mb-nav-btn mb-btn-panic" type="button" aria-label="Stop all audio">🛑 Stop All</button>
          </div>
        </header>

        <main id="mbScreenStage" class="mb-screen-stage" role="main"></main>
      </div>
    `;

    const nav = this.root.querySelector('.mb-navbar');
    if (nav) {
      nav.addEventListener('click', (e) => {
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

  mountPlayWorkspace() {
    const stage = this.root?.querySelector('#mbScreenStage');
    if (stage) {
      playUI.mount(stage);
    }
  }

  // Backward-compatible router helper for tests
  navigateTo(screenName) {
    this.currentScreen = screenName === 'home' ? 'home' : 'play';
    if (this.currentScreen === 'play') {
      this.mountPlayWorkspace();
    }
  }

  // ==========================================================================
  // 4. PANIC & SAFETY
  // ==========================================================================

  panic() {
    audioEngine.panic();
    smartKeys.releaseAll();
    bassInstrument.hardStopAll();
    leadInstrument.stopAll();
    arpEngine.stop();
    grooveBox.stop();
    scheduler.stop();
  }
}

// Global Singleton Instance
export const appCore = new AppCore();

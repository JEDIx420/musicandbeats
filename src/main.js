/**
 * Music & Beats — Canonical Production Bootstrap Entrypoint (V39)
 *
 * Coordinates:
 * - Direct ES module composition
 * - Instantiation of AppCore shell
 * - Mounting PlayUI and RecordUI surfaces
 * - Project hydration and initial state restoration
 * - AudioContext unlock coordination
 * - Clean PWA service worker registration
 */

import { appCore } from './app-core.js';
import { projectManager } from './projects.js';
import { liveLooper } from './looper.js';
import { smartKeys } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { leadInstrument } from './instruments/lead.js';
import { arpEngine } from './arp-engine.js';
import { grooveBox } from './groove-box.js';

export function initializeMusicAndBeats(rootSelector = '#app') {
  const root = typeof document !== 'undefined' ? document.querySelector(rootSelector) : null;
  if (!root) {
    console.warn(`Mount container "${rootSelector}" not found`);
    return null;
  }

  // 1. Initialize project and looper state
  try {
    const projects = projectManager.listProjects();
    if (projects.length > 0) {
      projectManager.loadProject(projects[0].id);
    }
  } catch (err) {
    console.warn('Could not auto-restore recent project', err);
  }

  // 2. Mount application shell and router
  appCore.initialize(root);

  // 3. Register service worker for offline PWA capability
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          // Check for background SW updates
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New Music & Beats version available.');
                }
              });
            }
          });
        })
        .catch(err => console.warn('Service worker registration skipped', err));
    });
  }

  return {
    app: appCore,
    projects: projectManager,
    looper: liveLooper,
    smartKeys,
    bass: bassInstrument,
    lead: leadInstrument,
    arp: arpEngine,
    groove: grooveBox
  };
}

// Auto-boot if running in browser DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeMusicAndBeats('#app'));
  } else {
    initializeMusicAndBeats('#app');
  }
}

/**
 * Music & Beats — Canonical Help & "Explain Controls" Subsystem (V39)
 *
 * Consolidates:
 * - Help Center metadata registry across Play, Record, Looper, and Instruments (legacy help.js)
 * - "Explain Controls" mode: intercepts clicks to display rich educational summaries and tips
 *   without triggering underlying musical performance audio
 * - Accessible Modal Dialog rendering with keyboard trap and Esc key dismissal
 * - Clean delegation via data-help attribute (e.g. data-help="smart.key")
 */

export const HELP_REGISTRY = {
  // --- Navigation & Core ---
  'home.brand': {
    section: 'Getting Started',
    title: 'Music & Beats Home',
    short: 'Return to the start screen.',
    body: 'Takes you back to the Music & Beats home screen. Your locally saved projects and settings remain intact.',
    tip: 'Use this whenever you want to switch between Play and Record workflows.'
  },
  'home.play': {
    section: 'Getting Started',
    title: 'Play Mode',
    short: 'Jam immediately without building a recording session.',
    body: 'Play mode is the quickest way to experiment. Choose Smart Keys, Bass, Guitar, or Lead, add a Groove Box rhythm, shape the sound with Tone & FX, and optionally turn on Arp Lab.',
    tip: 'Start here if you want to hear ideas quickly.'
  },
  'home.record': {
    section: 'Getting Started',
    title: 'Record Mode',
    short: 'Build a BPM-locked loop one layer at a time.',
    body: 'Record mode creates a structured session with a fixed BPM, bar length, count-in, and multi-track loop layers. Each layer is recorded against the master Web Audio grid.',
    tip: 'Use Record when you want a loop you can save and return to.'
  },
  'play.audio': {
    section: 'Audio Engine',
    title: 'Start Audio',
    short: 'Unlock and start the browser audio engine.',
    body: 'Browsers require an explicit user gesture before Web Audio can run. Start Audio creates or resumes the AudioContext so instruments, beats, effects, and ARP playback can sound.',
    tip: 'If controls move but you hear nothing, press Start Audio first.'
  },
  'play.transport': {
    section: 'Play Transport',
    title: 'Beat Transport',
    short: 'Start or stop the Play-mode groove.',
    body: 'Runs or stops the current Groove Box rhythm at the Play BPM. Instruments and ARP can be performed over it.',
    tip: 'Set the BPM before starting if you already know the tempo you want.'
  },
  'play.bpm': {
    section: 'Play Transport',
    title: 'BPM',
    short: 'Sets the tempo for Play mode.',
    body: 'BPM means beats per minute. It controls Groove Box timing, the metronome, and BPM-locked ARP rates such as 1/8, 1/16, and 1/64.',
    tip: 'Lower values feel slower and more spacious; higher values feel faster and denser.'
  },
  'play.metronome': {
    section: 'Play Transport',
    title: 'Click / Metronome',
    short: 'Turns the tempo click on or off.',
    body: 'Plays a regular timing reference at the current BPM so you can perform or practice against the grid.',
    tip: 'Use the click when learning a part, then turn it off when the groove itself is enough.'
  },

  // --- Smart Keys ---
  'smart.key': {
    section: 'Smart Keys',
    title: 'Key Preset',
    short: 'Builds the seven Smart Keys from a musical key.',
    body: 'Creates the default seven scale-degree chords for the selected key. You can still edit individual chords afterwards.',
    tip: 'Pick the key first, then customize only the chords you want to change.'
  },
  'smart.voicing': {
    section: 'Smart Keys',
    title: 'Voicing',
    short: 'Changes how notes inside each chord are spread.',
    body: 'Close voicing keeps chord tones near each other. Open and wide voicings spread notes farther apart for a broader sound.',
    tip: 'Use close voicings for compact accompaniment and wider voicings for pads or cinematic parts.'
  },
  'smart.edit': {
    section: 'Smart Keys',
    title: 'Edit Chords',
    short: 'Customize individual Smart Key chord pads.',
    body: 'Opens chord editing so each of the seven pads can have its own root and chord type (or custom semitones) instead of using only the key preset defaults.',
    tip: 'Edit only the chord that needs changing; the other pads can remain generated from the key.'
  },
  'smart.transpose': {
    section: 'Smart Keys',
    title: 'Keys Transpose',
    short: 'Shifts Smart Keys by semitones (-12 to +12).',
    body: 'Shifts all chord pads up or down in pitch by semitones. Also updates any recorded Keys looper events without changing chord voicings.',
    tip: 'Useful for matching a vocal range quickly without re-voicing every chord.'
  },
  'smart.latch': {
    section: 'Smart Keys',
    title: 'Keys Latch',
    short: 'Holds the last played chord indefinitely.',
    body: 'With Latch on, tapping a chord pad continues sounding it until you tap another pad, tap the same pad again to release it, or stop transport. Feeds the Arpeggiator with custom intervals.',
    tip: 'Leaves your hands free to tweak Arp Lab or Tone & FX.'
  },

  // --- Bass ---
  'bass.preset': {
    section: 'Bass',
    title: 'Bass Sound',
    short: 'Selects the synth bass preset.',
    body: 'Choose between 7 dedicated bass presets: Sub Bass, Deep Club Sub, Reese Bass, Acid Bass, FM House Bass, Pluck Bass, or Future Growl.',
    tip: 'Sub Bass is warm and clean; Acid Bass and Reese Bass provide aggressive harmonic bite.'
  },
  'bass.transpose': {
    section: 'Bass',
    title: 'Bass Transpose',
    short: 'Shifts Bass notes by semitones (-12 to +12).',
    body: 'Transposes all bass pads and recorded looper events up or down in semitone steps.',
    tip: 'Keep bass in register 1 or 2 for deep low-end foundation.'
  },

  // --- Guitar ---
  'guitar.input': {
    section: 'Guitar',
    title: 'Audio Input',
    short: 'Connects your audio interface or microphone.',
    body: 'Streams live audio into the virtual amp and pedalboard. Requires explicit user permission before connecting.',
    tip: 'Use an audio interface with an instrument (Hi-Z) input for the best guitar tone.'
  },
  'guitar.patch': {
    section: 'Guitar',
    title: 'Virtual Amp Patch',
    short: 'Selects a tailored amp and pedalboard configuration.',
    body: 'Choose from 6 presets: Clean Glass, Warm Combo, Edge Crunch, Arena Lead, Ambient Swell, or Worship Shimmer.',
    tip: 'Clean Glass is crisp; Edge Crunch and Arena Lead offer tube-style saturation.'
  },

  // --- Lead ---
  'lead.voice': {
    section: 'Lead',
    title: 'Lead Instrument Sound',
    short: 'Selects the SoundFont sample or synthesized lead.',
    body: 'Choose from 44 GeneralUser GS sample instruments across Pianos, Organs, Guitars, Strings, Brass, and Synth Leads, or select rich analog fallback synths.',
    tip: 'Sample instruments download dynamically on demand and are cached in memory.'
  },
  'lead.glide': {
    section: 'Lead',
    title: 'Slide & Portamento Glide',
    short: 'Glides pitch between keys when dragging (0–300ms).',
    body: 'When Slide is on, dragging a pointer across keys smoothly glides the pitch of active notes without retriggering a new attack.',
    tip: 'Set glide around 60–100ms for natural vocal and flute-like phrasing.'
  },
  'lead.pitchStrip': {
    section: 'Lead',
    title: 'Pitch Bend Strip',
    short: 'Continuous pitch bend (±2, ±7, or ±12 semitones).',
    body: 'Drag up or down to bend pitch continuously. Springs back to 0 immediately upon pointer release.',
    tip: 'Select ±2 for subtle guitar bends, or ±12 for full octave dive-bombs.'
  },
  'lead.modStrip': {
    section: 'Lead',
    title: 'Modulation Strip',
    short: 'Controls vibrato intensity (0–100%).',
    body: 'Drag to adjust the depth of the 5.2Hz vibrato LFO. Stays at the selected value until moved again.',
    tip: 'Add modulation on held lead notes for expressive solo vibrato.'
  },

  // --- Arp Lab ---
  'arp.power': {
    section: 'Arp Lab',
    title: 'Arpeggiator Power',
    short: 'Turns the arpeggiator on or off.',
    body: 'When enabled, Smart Keys or Bass targets are converted into a BPM-locked note pattern scheduled via the Web Audio clock.',
    tip: 'Combine with Latch to let the arpeggio run while you tweak effects.'
  },
  'arp.rate': {
    section: 'Arp Lab',
    title: 'ARP Rate',
    short: 'Sets the BPM-locked subdivision speed (1/4 to 1/64).',
    body: 'Subdivides the beat into rhythmic pulses: 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32, or ultra-fast 1/64.',
    tip: '1/16 is the standard EDM rate; 1/64 produces intense machine-gun rolls.'
  },
  'arp.pattern': {
    section: 'Arp Lab',
    title: 'ARP Pattern / Direction',
    short: 'Order in which target notes are traversed.',
    body: 'Up, Down, Up/Down (ping-pong), Random, or Chord (staccato pulse).',
    tip: 'Up/Down is classic synthwave; Random creates evolving melodic textures.'
  },

  // --- Groove Box ---
  'groove.style': {
    section: 'Groove Box',
    title: 'Beat Style',
    short: 'Musical genre for procedural drum patterns.',
    body: 'Choose from 10 styles: Worship, Pop, Rock, Funk, House, Trap, Reggaeton, Lo-Fi, Keherwa, or Dadra.',
    tip: 'Select a style as a starting point, then tap steps in the 16-step grid to customize.'
  },
  'groove.energy': {
    section: 'Groove Box',
    title: 'Energy Level',
    short: 'Controls how active and busy generated grooves feel (1–5).',
    body: 'Higher energy adds extra ghost kicks, snare rolls, and continuous 16th-note hi-hats.',
    tip: 'Lower energy (1–2) leaves more sonic space for intricate keys and lead parts.'
  }
};

export class HelpSubsystem {
  constructor() {
    this.isExplainMode = false;
    this.modalElement = null;
    this.activeTopic = null;
    this.listeners = new Set();
  }

  setExplainMode(enabled) {
    this.isExplainMode = !!enabled;
    this.notify();
    return this.isExplainMode;
  }

  toggleExplainMode() {
    return this.setExplainMode(!this.isExplainMode);
  }

  getTopic(key) {
    return HELP_REGISTRY[key] || {
      section: 'Help',
      title: 'Control Information',
      short: 'No documentation available for this control.',
      body: 'Select another control or open the Help Center.',
      tip: ''
    };
  }

  showTopic(key) {
    const topic = this.getTopic(key);
    this.activeTopic = topic;
    this.renderModal(topic);
    this.notify();
  }

  closeModal() {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
    this.activeTopic = null;
    this.notify();
  }

  renderModal(topic) {
    this.closeModal();
    if (typeof document === 'undefined') return;

    const modal = document.createElement('div');
    modal.className = 'mb-help-modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'mbHelpTitle');

    modal.innerHTML = `
      <div class="mb-help-card">
        <header class="mb-help-header">
          <div>
            <span class="mb-help-kicker">${this.escape(topic.section)}</span>
            <h2 id="mbHelpTitle">${this.escape(topic.title)}</h2>
          </div>
          <button class="mb-help-close" type="button" aria-label="Close help modal">✕</button>
        </header>
        <div class="mb-help-body">
          <p class="mb-help-short"><strong>${this.escape(topic.short)}</strong></p>
          <p class="mb-help-description">${this.escape(topic.body)}</p>
          ${topic.tip ? `<div class="mb-help-tip"><span class="tip-icon">💡</span><span>${this.escape(topic.tip)}</span></div>` : ''}
        </div>
        <footer class="mb-help-footer">
          <button class="mb-help-done v34-accent" type="button">Got it</button>
        </footer>
      </div>
    `;

    modal.querySelector('.mb-help-close').onclick = () => this.closeModal();
    modal.querySelector('.mb-help-done').onclick = () => this.closeModal();
    modal.onclick = (e) => {
      if (e.target === modal) this.closeModal();
    };

    document.body.appendChild(modal);
    this.modalElement = modal;

    // Esc key handler
    const onKey = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  escape(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
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
export const helpSubsystem = new HelpSubsystem();

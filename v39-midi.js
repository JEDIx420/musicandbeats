/* Music & Beats V39 Web MIDI and AKAI MPK mini engine. */
(()=>{
  if (window.MB_MIDI) return;

  const CONFIG_KEY = 'musicandbeats:midi:config';
  const DEVICE_KEY = 'musicandbeats:midi:device';

  const DEFAULT_CONFIG = {
    profile: 'akai_mpk_mini',
    keyboardTarget: 'lead', // 'lead', 'bass', 'keys'
    pads: [
      { target: 'pad_0', label: 'Pad 1', type: 'note', number: 36, channel: -1 },
      { target: 'pad_1', label: 'Pad 2', type: 'note', number: 37, channel: -1 },
      { target: 'pad_2', label: 'Pad 3', type: 'note', number: 38, channel: -1 },
      { target: 'pad_3', label: 'Pad 4', type: 'note', number: 39, channel: -1 },
      { target: 'pad_4', label: 'Pad 5', type: 'note', number: 40, channel: -1 },
      { target: 'pad_5', label: 'Pad 6', type: 'note', number: 41, channel: -1 },
      { target: 'pad_6', label: 'Pad 7', type: 'note', number: 42, channel: -1 },
      { target: 'pad_7', label: 'Pad 8', type: 'note', number: 43, channel: -1 }
    ],
    knobs: [
      { target: 'beats_level', label: 'K1 · Beats Vol', type: 'cc', number: 70, channel: -1 },
      { target: 'keys_level', label: 'K2 · Keys Vol', type: 'cc', number: 71, channel: -1 },
      { target: 'bass_level', label: 'K3 · Bass Vol', type: 'cc', number: 72, channel: -1 },
      { target: 'lead_level', label: 'K4 · Lead Vol', type: 'cc', number: 73, channel: -1 },
      { target: 'lead_tone', label: 'K5 · Filter Tone', type: 'cc', number: 74, channel: -1 },
      { target: 'lead_intensity', label: 'K6 · FX Intensity', type: 'cc', number: 75, channel: -1 },
      { target: 'lead_space', label: 'K7 · Space / Wet', type: 'cc', number: 76, channel: -1 },
      { target: 'tempo', label: 'K8 · Tempo / BPM', type: 'cc', number: 77, channel: -1 }
    ]
  };

  let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
    if (saved) {
      if (saved.keyboardTarget) config.keyboardTarget = saved.keyboardTarget;
      if (Array.isArray(saved.pads) && saved.pads.length === 8) config.pads = saved.pads;
      if (Array.isArray(saved.knobs) && saved.knobs.length === 8) config.knobs = saved.knobs;
    }
  } catch {}

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {}
  }

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  function midiNoteLabel(num) {
    if (num < 0 || num > 127) return `Note ${num}`;
    const name = NOTE_NAMES[num % 12];
    const oct = Math.floor(num / 12) - 1;
    return `${name}${oct} (${num})`;
  }

  const state = {
    supported: typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function',
    access: null,
    inputs: [],
    selectedInput: null,
    selectedId: null,
    status: 'disconnected', // 'disconnected', 'connecting', 'connected', 'error', 'unsupported'
    statusMessage: 'Disconnected',
    deviceName: '',
    isAkai: false,
    activeNotes: new Map(),
    activeMidiPads: new Map(),
    learning: null, // { kind: 'pad' | 'knob', index: number }
    lastEvent: null,
    dialogOpen: false
  };

  function isAkaiDevice(name) {
    if (!name) return false;
    const s = name.toLowerCase();
    return s.includes('mpk') || s.includes('akai') || s.includes('mini');
  }

  async function requestAccess() {
    if (!state.supported) {
      state.status = 'unsupported';
      state.statusMessage = 'Web MIDI is not supported in this browser.';
      updateUI();
      return null;
    }
    state.status = 'connecting';
    state.statusMessage = 'Requesting MIDI access…';
    updateUI();

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      state.access = access;
      access.onstatechange = handleStateChange;
      refreshInputs();
      autoSelectDevice();
      return access;
    } catch (err) {
      state.status = 'error';
      state.statusMessage = `MIDI Access denied: ${err.message}`;
      updateUI();
      return null;
    }
  }

  function refreshInputs() {
    if (!state.access) return;
    const inputs = [];
    for (const input of state.access.inputs.values()) {
      inputs.push(input);
    }
    state.inputs = inputs;
  }

  function autoSelectDevice() {
    refreshInputs();
    if (!state.inputs.length) {
      disconnectCurrent();
      state.status = 'disconnected';
      state.statusMessage = 'No MIDI devices connected.';
      updateUI();
      return;
    }

    let preferred = null;
    try { preferred = localStorage.getItem(DEVICE_KEY); } catch {}

    let chosen = null;
    if (preferred) {
      chosen = state.inputs.find(i => i.id === preferred || i.name === preferred);
    }
    if (!chosen) {
      // Prioritize AKAI MPK mini
      chosen = state.inputs.find(i => isAkaiDevice(i.name)) || state.inputs[0];
    }

    if (chosen) {
      connectInput(chosen);
    }
  }

  function connectInput(input) {
    if (!input) return;
    disconnectCurrent();
    state.selectedInput = input;
    state.selectedId = input.id;
    state.deviceName = input.name || 'Unknown Device';
    state.isAkai = isAkaiDevice(state.deviceName);
    state.status = 'connected';
    state.statusMessage = `Connected: ${state.deviceName}`;

    try {
      localStorage.setItem(DEVICE_KEY, input.id);
    } catch {}

    input.onmidimessage = handleMIDIMessage;
    updateUI();
  }

  function disconnectCurrent() {
    if (state.selectedInput) {
      try { state.selectedInput.onmidimessage = null; } catch {}
    }
    panic();
    state.selectedInput = null;
    state.selectedId = null;
    state.deviceName = '';
    state.isAkai = false;
    state.status = 'disconnected';
    state.statusMessage = 'Disconnected';
  }

  function handleStateChange(e) {
    refreshInputs();
    const port = e.port;
    if (port && port.type === 'input') {
      if (port.state === 'disconnected') {
        if (state.selectedInput && state.selectedInput.id === port.id) {
          disconnectCurrent();
          autoSelectDevice();
        }
      } else if (port.state === 'connected') {
        if (!state.selectedInput) {
          autoSelectDevice();
        }
      }
    }
    updateUI();
  }

  function panic() {
    // 1. Release active keyboard notes
    for (const [midi, voice] of state.activeNotes) {
      try { voice?.stop?.(); } catch {}
    }
    state.activeNotes.clear();

    // 2. Stop any Lead voices
    try { window.MB_V39?.stopLead?.(); } catch {}

    // 3. Clear UI keys
    document.querySelectorAll('#v38Keyboard .v38-key.active').forEach(k => k.classList.remove('active'));

    // 4. Release active pads
    for (const [padIdx, pointerId] of state.activeMidiPads) {
      releasePadPointer(padIdx, pointerId);
    }
    state.activeMidiPads.clear();
  }

  function releasePadPointer(padIdx, pointerId) {
    const looper = window.MB_V34_LOOPER;
    const lane = looper?.state?.activeLane || 'keys';
    if (lane === 'keys') {
      const pads = document.querySelectorAll('#v34ChordPads .v34-performance-pad');
      if (pads[padIdx]) {
        pads[padIdx].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId }));
      }
    } else if (lane === 'bass') {
      const pads = document.querySelectorAll('#v34BassPads .v34-bass-pad');
      if (pads[padIdx]) {
        pads[padIdx].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId }));
      }
    }
  }

  function handleMIDIMessage(e) {
    if (!e?.data || e.data.length < 2) return;
    const status = e.data[0];
    const data1 = e.data[1];
    const data2 = e.data.length > 2 ? e.data[2] : 0;
    const cmd = status >> 4;
    const ch = (status & 0xF) + 1;

    // Record diagnostics
    let typeName = 'Unknown';
    if (cmd === 0x9) typeName = data2 > 0 ? 'Note On' : 'Note Off';
    else if (cmd === 0x8) typeName = 'Note Off';
    else if (cmd === 0xB) typeName = 'CC';
    else if (cmd === 0xE) typeName = 'Pitch Bend';
    else if (cmd === 0xC) typeName = 'Program Change';

    state.lastEvent = {
      type: typeName,
      status,
      cmd,
      data1,
      data2,
      ch,
      time: performance.now()
    };
    updateMonitorUI();

    // 1. MIDI Learn Interception
    if (state.learning) {
      const { kind, index } = state.learning;
      if (kind === 'pad') {
        if (cmd === 0x9 && data2 > 0) {
          config.pads[index].number = data1;
          config.pads[index].channel = ch;
          state.learning = null;
          saveConfig();
          updateUI();
          return;
        }
      } else if (kind === 'knob') {
        if (cmd === 0xB) {
          config.knobs[index].number = data1;
          config.knobs[index].channel = ch;
          state.learning = null;
          saveConfig();
          updateUI();
          return;
        }
      }
    }

    // 2. Control Change Messages
    if (cmd === 0xB) {
      // Mod Wheel
      if (data1 === 1) {
        const norm = data2 / 127;
        if (window.MB_V39?.state) {
          window.MB_V39.state.mod = norm;
          window.MB_V39.updateLeadUI?.();
        }
        return;
      }
      // Panic / All Notes Off
      if (data1 === 120 || data1 === 123) {
        panic();
        return;
      }

      // Check Knobs 1..8
      const knobIdx = config.knobs.findIndex(k => k.number === data1 && (k.channel === -1 || k.channel === ch));
      if (knobIdx >= 0) {
        applyKnobAction(config.knobs[knobIdx].target, data2 / 127);
        return;
      }
      return;
    }

    // 3. Pitch Bend Messages
    if (cmd === 0xE) {
      const bendVal = (data2 << 7) | data1;
      const norm = (bendVal - 8192) / 8192;
      if (window.MB_V39?.state) {
        const range = window.MB_V39.state.pitchRange || 2;
        window.MB_V39.state.pitchBend = norm * range;
        window.MB_V39.applyPitch?.();
        window.MB_V39.updateLeadUI?.();
      }
      return;
    }

    // 4. Note Messages (Pads vs Keyboard)
    if (cmd === 0x9 || cmd === 0x8) {
      const isNoteOn = cmd === 0x9 && data2 > 0;
      const padIdx = config.pads.findIndex(p => p.number === data1 && (p.channel === -1 || p.channel === ch));

      if (padIdx >= 0) {
        // Targeted Pad interaction
        if (isNoteOn) {
          handlePadDown(padIdx, data2 / 127);
        } else {
          handlePadUp(padIdx);
        }
        return;
      }

      // Main Keyboard interaction
      if (isNoteOn) {
        handleKeyboardDown(data1, data2 / 127);
      } else {
        handleKeyboardUp(data1);
      }
    }
  }

  function handlePadDown(padIdx, velocity) {
    const looper = window.MB_V34_LOOPER;
    const lane = looper?.state?.activeLane || 'keys';
    const pointerId = 7000 + padIdx;
    state.activeMidiPads.set(padIdx, pointerId);

    if (lane === 'keys') {
      if (padIdx < 7) {
        const pads = document.querySelectorAll('#v34ChordPads .v34-performance-pad');
        const pad = pads[padIdx];
        if (pad) {
          pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId }));
        }
      } else if (padIdx === 7) {
        // Pad 8: Toggle latch
        window.MB_V36?.toggleLatch?.('keys');
      }
    } else if (lane === 'bass') {
      if (padIdx < 8) {
        const pads = document.querySelectorAll('#v34BassPads .v34-bass-pad');
        const pad = pads[padIdx];
        if (pad) {
          pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId }));
        }
      }
    }
  }

  function handlePadUp(padIdx) {
    const pointerId = state.activeMidiPads.get(padIdx) || (7000 + padIdx);
    state.activeMidiPads.delete(padIdx);
    releasePadPointer(padIdx, pointerId);
  }

  function handleKeyboardDown(midi, velocity) {
    const target = config.keyboardTarget || 'lead';
    if (target === 'lead') {
      window.MB_V39?.startMidiLead?.(midi, velocity);
    } else if (target === 'bass') {
      if (typeof ensureAudio === 'function') ensureAudio();
      const preset = window.MB_V34_LOOPER?.tracks?.bass?.sound || 'Sub Bass';
      const targetBus = window.MB_V34_LOOPER?.playbackBus || synthBus || ctx?.destination;
      const voice = window.startVoice?.(midi, preset, velocity * 0.9, targetBus);
      if (voice) state.activeNotes.set(midi, voice);
    } else if (target === 'keys') {
      if (typeof ensureAudio === 'function') ensureAudio();
      const preset = window.MB_V34_LOOPER?.tracks?.keys?.sound || 'Studio Grand';
      const targetBus = window.MB_V34_LOOPER?.playbackBus || synthBus || ctx?.destination;
      const voice = window.startVoice?.(midi, preset, velocity * 0.85, targetBus);
      if (voice) state.activeNotes.set(midi, voice);
    }
  }

  function handleKeyboardUp(midi) {
    const target = config.keyboardTarget || 'lead';
    if (target === 'lead') {
      window.MB_V39?.stopMidiLead?.(midi);
    } else {
      const voice = state.activeNotes.get(midi);
      if (voice) {
        try { voice.stop?.(); } catch {}
        state.activeNotes.delete(midi);
      }
    }
  }

  function applyKnobAction(target, val) {
    const V37 = window.MB_V37;
    const V38 = window.MB_V38;
    const looper = window.MB_V34_LOOPER;

    switch (target) {
      case 'beats_level':
        if (V37?.mix) {
          V37.mix.beats = Number((val * 1.2).toFixed(2));
          V37.saveLocal?.();
        }
        break;
      case 'keys_level':
        if (V37?.mix) {
          V37.mix.keys = Number((val * 1.2).toFixed(2));
          V37.saveLocal?.();
        }
        break;
      case 'bass_level':
        if (V37?.mix) {
          V37.mix.bass = Number((val * 1.2).toFixed(2));
          V37.saveLocal?.();
        }
        break;
      case 'lead_level':
        if (V37?.mix) {
          V37.mix.lead = Number((val * 1.4).toFixed(2));
          V37.saveLocal?.();
        }
        break;
      case 'lead_tone':
        if (V38?.state?.fx) {
          V38.state.fx.tone = Math.round(val * 100);
          const el = document.querySelector('#v38Tone');
          if (el) el.value = V38.state.fx.tone;
          if (typeof ctx !== 'undefined' && ctx) window.MB_V39?.buildLeadFX?.();
        }
        break;
      case 'lead_intensity':
        if (V38?.state?.fx) {
          V38.state.fx.intensity = Math.round(val * 100);
          const el = document.querySelector('#v38Intensity');
          if (el) el.value = V38.state.fx.intensity;
          if (typeof ctx !== 'undefined' && ctx) window.MB_V39?.buildLeadFX?.();
        }
        break;
      case 'lead_space':
        if (V38?.state?.fx) {
          V38.state.fx.wet = Math.round(val * 100);
          const el = document.querySelector('#v38Wet');
          if (el) el.value = V38.state.fx.wet;
          if (typeof ctx !== 'undefined' && ctx) window.MB_V39?.buildLeadFX?.();
        }
        break;
      case 'tempo':
        if (looper?.state) {
          const bpm = Math.round(40 + val * 180);
          looper.state.bpm = bpm;
          const bpmInput = document.querySelector('#v34Bpm');
          if (bpmInput) bpmInput.value = bpm;
          const homeBpm = document.querySelector('#v35HomeBpm');
          if (homeBpm) homeBpm.value = bpm;
          looper.persist?.();
        }
        break;
    }
  }

  // --- UI Installation & Rendering ---

  function installButton() {
    const actions = document.querySelector('.top-actions');
    if (!actions) return;
    let btn = document.querySelector('#v39MidiBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'v39MidiBtn';
      btn.type = 'button';
      btn.className = 'v39-midi-btn';
      btn.innerHTML = '<span class="v39-midi-dot"></span><span>MIDI</span>';
      btn.onclick = () => openDialog();
      actions.insertBefore(btn, actions.firstChild);
    }
    btn.classList.toggle('connected', state.status === 'connected');
  }

  function installDialog() {
    let d = document.querySelector('#v39MidiDialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'v39MidiDialog';
    d.className = 'v39-midi-dialog';
    d.innerHTML = `
      <div class="v39-midi-shell">
        <header class="v39-midi-header">
          <div class="v39-midi-header-left">
            <div class="v39-midi-title">
              <small>HARDWARE INTEGRATION</small>
              <h2>MIDI · AKAI MPK mini</h2>
            </div>
          </div>
          <button type="button" class="v39-midi-close" data-close aria-label="Close">×</button>
        </header>
        <div class="v39-midi-body" id="v39MidiContent"></div>
      </div>
    `;
    document.body.appendChild(d);
    d.querySelector('[data-close]').onclick = () => closeDialog();
    d.onclick = (e) => { if (e.target === d) closeDialog(); };
    return d;
  }

  function openDialog() {
    const d = installDialog();
    state.dialogOpen = true;
    if (!state.access && state.supported) {
      requestAccess();
    } else {
      updateUI();
    }
    if (!d.open) d.showModal();
  }

  function closeDialog() {
    const d = document.querySelector('#v39MidiDialog');
    state.dialogOpen = false;
    state.learning = null;
    if (d?.open) d.close();
    installButton();
  }

  function updateUI() {
    installButton();
    const content = document.querySelector('#v39MidiContent');
    if (!content || !state.dialogOpen) return;

    const connected = state.status === 'connected';
    const isAkai = state.isAkai;

    content.innerHTML = `
      <!-- Device Bar -->
      <div class="v39-midi-status-bar">
        <div class="v39-midi-device-select">
          <label>Input device:</label>
          <select id="v39MidiInputSelect">
            ${state.inputs.length === 0 ? '<option value="">No devices found</option>' : ''}
            ${state.inputs.map(i => `<option value="${i.id}" ${state.selectedId === i.id ? 'selected' : ''}>${i.name || i.id}</option>`).join('')}
          </select>
        </div>
        <div class="v39-midi-actions">
          <button id="v39MidiConnectBtn" type="button" class="v39-btn-sm ${connected ? '' : 'v39-btn-primary'}">${connected ? 'Reconnect' : 'Connect MIDI'}</button>
          <button id="v39MidiPanicBtn" type="button" class="v39-btn-sm">Panic / All Off</button>
          <button id="v39MidiResetBtn" type="button" class="v39-btn-sm v39-btn-danger">Reset Mapping</button>
        </div>
      </div>

      <!-- Live Diagnostics Monitor -->
      <div class="v39-midi-monitor" id="v39MidiMonitor">
        <span>Last MIDI Event:</span>
        <strong id="v39MidiMonitorText">${formatLastEvent()}</strong>
      </div>

      <!-- Keyboard Routing -->
      <section class="v39-midi-section">
        <div class="v39-midi-section-head">
          <h3>AKAI Piano Keys</h3>
          <small>Default: Current Lead instrument</small>
        </div>
        <div class="v39-midi-status-bar">
          <div class="v39-midi-device-select">
            <label>Keys Route To:</label>
            <select id="v39MidiKeyboardTarget">
              <option value="lead" ${config.keyboardTarget === 'lead' ? 'selected' : ''}>Lead Instrument (Polyphonic + Pitch/Mod)</option>
              <option value="bass" ${config.keyboardTarget === 'bass' ? 'selected' : ''}>Bass Instrument (Chromatic)</option>
              <option value="keys" ${config.keyboardTarget === 'keys' ? 'selected' : ''}>Smart Keys Voice (Chromatic)</option>
            </select>
          </div>
        </div>
      </section>

      <!-- 8 Performance Pads -->
      <section class="v39-midi-section">
        <div class="v39-midi-section-head">
          <h3>8 Performance Pads</h3>
          <small>Contextual: Smart Keys (1–7) or Bass (1–8) with seamless recording</small>
        </div>
        <div class="v39-midi-grid-8">
          ${config.pads.map((p, i) => {
            const isLearning = state.learning?.kind === 'pad' && state.learning?.index === i;
            return `
              <div class="v39-midi-card ${isLearning ? 'learning' : ''}">
                <div class="v39-midi-card-head">
                  <strong>Pad ${i + 1}</strong>
                  <span>${i === 7 ? 'Latch / Note 8' : `Slot ${i + 1}`}</span>
                </div>
                <div class="v39-midi-card-value">${p.number !== null ? midiNoteLabel(p.number) : 'Unmapped'}</div>
                <div class="v39-midi-card-actions">
                  <button type="button" data-learn-pad="${i}" class="${isLearning ? 'active-learn' : ''}">${isLearning ? 'Listening…' : 'Learn'}</button>
                  <button type="button" data-clear-pad="${i}">Clear</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- 8 Knobs -->
      <section class="v39-midi-section">
        <div class="v39-midi-section-head">
          <h3>8 Control Knobs</h3>
          <small>Mapped to mixer levels, Lead tone, and tempo</small>
        </div>
        <div class="v39-midi-grid-8">
          ${config.knobs.map((k, i) => {
            const isLearning = state.learning?.kind === 'knob' && state.learning?.index === i;
            return `
              <div class="v39-midi-card ${isLearning ? 'learning' : ''}">
                <div class="v39-midi-card-head">
                  <strong>${k.label}</strong>
                  <span>K${i + 1}</span>
                </div>
                <div class="v39-midi-card-value">${k.number !== null ? `CC ${k.number}` : 'Unmapped'}</div>
                <div class="v39-midi-card-actions">
                  <button type="button" data-learn-knob="${i}" class="${isLearning ? 'active-learn' : ''}">${isLearning ? 'Listening…' : 'Learn'}</button>
                  <button type="button" data-clear-knob="${i}">Clear</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;

    bindDialogEvents(content);
  }

  function formatLastEvent() {
    if (!state.lastEvent) return 'None (press any key, pad or knob on your controller)';
    const ev = state.lastEvent;
    if (ev.type === 'Note On' || ev.type === 'Note Off') {
      return `${ev.type} · ${midiNoteLabel(ev.data1)} · Vel ${ev.data2} · Ch ${ev.ch}`;
    }
    if (ev.type === 'CC') {
      return `CC ${ev.data1} · Value ${ev.data2} · Ch ${ev.ch}`;
    }
    if (ev.type === 'Pitch Bend') {
      const bend = (ev.data2 << 7) | ev.data1;
      return `Pitch Bend · Value ${bend} (center 8192) · Ch ${ev.ch}`;
    }
    return `${ev.type} · Data: [${ev.data1}, ${ev.data2}] · Ch ${ev.ch}`;
  }

  function updateMonitorUI() {
    const el = document.querySelector('#v39MidiMonitorText');
    if (el) el.textContent = formatLastEvent();
  }

  function bindDialogEvents(content) {
    const sel = content.querySelector('#v39MidiInputSelect');
    if (sel) {
      sel.onchange = (e) => {
        const id = e.target.value;
        const target = state.inputs.find(i => i.id === id);
        if (target) connectInput(target);
      };
    }

    const connectBtn = content.querySelector('#v39MidiConnectBtn');
    if (connectBtn) {
      connectBtn.onclick = () => requestAccess();
    }

    const panicBtn = content.querySelector('#v39MidiPanicBtn');
    if (panicBtn) {
      panicBtn.onclick = () => panic();
    }

    const resetBtn = content.querySelector('#v39MidiResetBtn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        saveConfig();
        updateUI();
      };
    }

    const kbTarget = content.querySelector('#v39MidiKeyboardTarget');
    if (kbTarget) {
      kbTarget.onchange = (e) => {
        config.keyboardTarget = e.target.value;
        saveConfig();
      };
    }

    // Pad learn / clear
    content.querySelectorAll('[data-learn-pad]').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.learnPad;
        if (state.learning?.kind === 'pad' && state.learning?.index === idx) {
          state.learning = null;
        } else {
          state.learning = { kind: 'pad', index: idx };
        }
        updateUI();
      };
    });
    content.querySelectorAll('[data-clear-pad]').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.clearPad;
        config.pads[idx].number = null;
        saveConfig();
        updateUI();
      };
    });

    // Knob learn / clear
    content.querySelectorAll('[data-learn-knob]').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.learnKnob;
        if (state.learning?.kind === 'knob' && state.learning?.index === idx) {
          state.learning = null;
        } else {
          state.learning = { kind: 'knob', index: idx };
        }
        updateUI();
      };
    });
    content.querySelectorAll('[data-clear-knob]').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.clearKnob;
        config.knobs[idx].number = null;
        saveConfig();
        updateUI();
      };
    });
  }

  function init() {
    installButton();
    // Re-install button when navbar changes
    const observer = new MutationObserver(() => installButton());
    observer.observe(document.body, { childList: true, subtree: true });

    // Try passive initialization if access already granted
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        navigator.permissions.query({ name: 'midi', sysex: false }).then(perm => {
          if (perm.state === 'granted') {
            requestAccess();
          }
        }).catch(() => {});
      } catch {}
    }
  }

  init();

  window.MB_MIDI = {
    version: 'v39',
    state,
    config,
    requestAccess,
    connectInput,
    disconnectCurrent,
    panic,
    openDialog,
    closeDialog,
    saveConfig,
    DEFAULT_CONFIG,
    handleMIDIMessage,
    applyKnobAction
  };
})();

# Music & Beats V32 — UI Core Stability + Help

## Goals

1. Parameter changes must never change Play drawer visibility.
2. ARP controls must update state without reconstructing the Arp Lab module.
3. The existing V31 audio-performance core remains untouched.
4. Every interactive control receives contextual help coverage.
5. Desktop, tablet and mobile use the same help content and state model.

## Stability architecture

`ui-core.js` loads after the historical UI patches and performance core.

- Play `select`, `input` and `textarea` changes are classified as non-structural.
- The historical V24 `change -> v24Schedule()` path is suppressed during those parameter events.
- The historical delayed V28 ARP topology restore is suppressed during ARP parameter edits.
- Legitimate structural events can still rebuild the Play stack.
- Explicit drawer state is preserved across legitimate structural rebuilds.
- Arp Lab receives a final state assertion after parameter changes so an open drawer stays open.
- V25 remains the underlying persisted Show/Hide implementation; V32 exposes one public UI-core drawer API for new code.

## Help architecture

`help.js` and `help.css` use browser-native APIs only.

- One central help registry contains the canonical explanations.
- Known controls receive detailed articles.
- Dynamic ARP controls are resolved from their stable data keys.
- Groove Box, expression and FX controls resolve contextually from their control labels.
- Any unrecognized future interactive control receives a safe contextual fallback so help coverage does not silently disappear.
- One floating tooltip serves all desktop hover/focus help.
- Form controls receive compact clickable info affordances.
- A global Help button opens the searchable Help Center.
- Explain Controls mode intercepts at `window` capture phase so tapping playable surfaces explains them without triggering notes/beats/buttons.
- One filtered MutationObserver scans only when interactive DOM is actually added; it does not react to ordinary class, waveform or audio-state updates.

## Help Center journeys

### Quick Jam
Start Audio → Smart Keys → Groove Box → play chords → Latch → Arp Lab.

### Build a Loop
Record → BPM & bars → source → record layer → add layers → Play Session → Save.

## Regression gate

### Desktop
- Chrome and Safari-sized desktop layouts.
- Hover tooltips on buttons/selects/ranges/tabs.
- Info buttons open detailed help.
- Help search filters cards correctly.
- Explain Controls mode prevents the underlying control from firing.

### Tablet / iPad
- Landscape and portrait.
- Tap info affordances.
- Explain Controls on Smart Keys, piano keys, Groove Box and ARP.
- Rotate while Play drawers are open.
- Drawer state remains unchanged.

### Mobile
- Help Center fits the viewport and scrolls independently.
- Help banner remains reachable above safe-area insets.
- Form info affordances have touch-sized targets.

### ARP stability stress test
With Arp Lab open, repeatedly change:

- 1/8 ↔ 1/16 ↔ 1/32 ↔ 1/64
- Direction
- Octaves
- Gate
- Swing
- Ratchet x1 ↔ x4
- Offset
- Motion
- Steps
- Distance
- Velocity
- Retrigger
- Rhythm cells

The Arp Lab drawer must never collapse or require a second Show/Hide click.

### Performance regression
Re-run the V31 `?debug=perf` heavy scenario after V32. Help/UI work must not materially increase audio hot-path costs or continuous DOM mutation rates.

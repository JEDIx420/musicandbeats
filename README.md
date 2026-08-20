# Music & Beats

An iPad-first six-layer live looper built as a lightweight static PWA.

## Current V1 features

- Up to 6 loop layers
- Each layer can record from:
  - connected audio input
  - built-in keyboard/synth
  - beat machine
- BPM and swing controls
- Metronome
- 16-step beat sequencer
- Beat presets: Worship, Pop, Rock, Funk, House, Trap, Reggaeton, Lo-Fi
- Generate Beat creates editable variations
- Touch piano keyboard
- Multiple synth/keys sounds
- Smart Chords by musical key
- Triads, 6ths, 7ths, Maj7, m7, 9ths, Maj9, m9, 11ths, 13ths, sus2 and sus4
- Project saving in IndexedDB on the device
- Offline app shell via service worker
- Installable as a PWA / Add to Home Screen on iPad

## Run locally

This project is intentionally dependency-free. Serve the repository over HTTP/HTTPS rather than opening `index.html` directly because microphone access and service workers require a secure context.

Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` on a development machine.

## GitHub Pages

The app can be hosted directly from this repository.

After merging the feature branch into `main`:

1. Open **Settings → Pages** in the repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save.

The site should then be available at:

`https://jedix420.github.io/musicandbeats/`

For iPad usage, open the site in Safari, grant microphone permission, then use **Share → Add to Home Screen**.

## Notes

The current sound engine uses Web Audio synthesis so the entire app remains small and self-contained. A later sound-pack system can add sampled grand pianos, Rhodes, organs, strings, pads and other instruments from CDN/object storage without bloating the GitHub Pages deployment.

Browser audio routing is limited by what iPadOS/Safari exposes. USB audio interfaces that appear as an iPad audio input can be selected after microphone/audio permission is granted.

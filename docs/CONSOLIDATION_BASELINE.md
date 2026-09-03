# Music & Beats — Consolidation Baseline (Reconciled to V39)

## 1. Baseline Git Information
- **V38 Anchor Commit SHA**: `92266e42bbd9a58441f80ff832885d869b37b92d`
- **V38 Rollback Tag**: `pre-consolidation-v38`
- **V38 Archive Branch**: `archive/v38-patch-runtime`
- **Authoritative V39 Commit SHA**: `a0fe010cf4bb70b00f738d3fa4cc72b594a68002`
- **V39 Rollback Tag**: `pre-consolidation-v39`
- **V39 Archive Branch**: `archive/v39-patch-runtime`
- **Ancestry**: `92266e4` is proven an ancestor of `a0fe010` via `git merge-base --is-ancestor`.
- **Refactoring Work Branch**: `refactor/runtime-consolidation` (rebased onto `a0fe010`)
- **Remote Push Status**: All safety tags (`pre-consolidation-v38`, `pre-consolidation-v39`) and archive branches (`archive/v38-patch-runtime`, `archive/v39-patch-runtime`) have been safely pushed to `origin`.

## 2. Build Version
- **Build Version (`build-version.json`)**: `v39`
- **Description**: `keys/bass transpose, customizable chords, Western GeneralUser GS catalog, glide, and pitch/mod performance strips`
- **Published At**: `2026-09-02T19:40:00+05:30`

## 3. Runtime Loader Chains

### Initial HTML Boot (`index.html`)
The static HTML head loads styles, while the bottom loads initial scripts synchronously:

#### HTML `<head>` CSS Links:
1. `styles.css`
2. `v4.css`
3. `v5.css`
4. `v6.css`
5. `v6-patch.css`
6. `v7.css`
7. `v8.css`

#### HTML Body `<script>` Tags:
1. `app.js`
2. `workflow-fixes.js`
3. `v4-fixes.js`
4. `v5-fixes.js`
5. `v5-hotfix.js`
6. `v6.js`
7. `v6-patch.js`
8. `v7.js`
9. `v8.js`

### Dynamic Secondary Loader (`v8.js` -> `v9.js`)
When `v8.js` executes:
- Preloads scripts: `['v9','v10','v12','v13','v14','v15','v16','v17','v17-fixes','v17-post','v18','v18-fixes','v19','v22','v23']`
- Dynamically injects stylesheet `v9.css`
- Dynamically injects script `v9.js`
- Dynamically injects script `update-guard.js`

### Tertiary Loader (`v9.js` -> V10 through V39)
When `v9.js` executes:
- Dynamically ensures CSS links:
  `['v10','v12','v14','v15','v16','v17','v18','v19','v22','v23','v24','v25','v26','v27','v28','v29','help','keyboard-ui','v34-looper','v35','v36','v37','v38','v39']`
- Dynamically executes script tags sequentially (`v9LoadPatchChain`):
  1. `v10.js`
  2. `v12.js`
  3. `v13.js`
  4. `v14.js`
  5. `v15.js`
  6. `v16.js`
  7. `v17.js`
  8. `v17-fixes.js`
  9. `v17-post.js`
  10. `v18.js`
  11. `v18-fixes.js`
  12. `v19.js`
  13. `v22.js`
  14. `v23.js`
  15. `v24.js`
  16. `v25.js`
  17. `v26.js`
  18. `v27.js`
  19. `v28.js`
  20. `v29.js`
  21. `core-performance.js`
  22. `core-performance-fixes.js`
  23. `ui-core.js`
  24. `help.js`
  25. `keyboard-ui.js`
  26. `v34-looper.js`
  27. `v35-core.js`
  28. `v35-ui.js`
  29. `v35.js`
  30. `v36.js`
  31. `v37.js`
  32. `v38.js`
  33. `v38-stability.js`
  34. `v39-core.js` (NEW: Transpose, editable chords, custom intervals, latch playback ownership)
  35. `v39-lead.js` (NEW: Glide, pitch/mod strips, Western GeneralUser GS catalog)
  36. `v39.js`      (NEW: V39 lifecycle bootstrap)

## 4. File Counts & Byte Metrics
- **Total Root JavaScript Files**: 50 (+3 from V38: `v39-core.js`, `v39-lead.js`, `v39.js`)
- **Total Root CSS Files**: 34 (+1 from V38: `v39.css`)
- **Total JS Bytes**: 519,850 bytes (~508 KB)
- **Total CSS Bytes**: 186,895 bytes (~182 KB)
- **Total Code Volume**: 6,016 lines across 84 files
- **Total Runtime Scripts Executed**: 47 scripts (9 in HTML + v9.js + update-guard.js + 36 in v9 chain)
- **Total Runtime Stylesheets Injected**: 32 CSS files (7 in HTML + v9.css + 24 in v9 list)
- **`node --check` syntax status**: Passed 100% on all 50 JS files with zero syntax errors.

## 5. Service Worker Metrics (`sw.js`)
- **Cache Name**: `musicandbeats-v39`
- **Cached Assets Count**: 95 assets (+5 from V38: `./v39.css`, `./v39-core.js`, `./v39-lead.js`, `./v39.js`, plus assets)
  - 47 JS files
  - 33 CSS files
  - 1 HTML file (`./index.html`)
  - 1 Root path (`./`)
  - 1 Manifest (`./manifest.webmanifest`)
  - 1 Main icon (`./icon.svg`)
  - 1 AudioWorklet (`./recorder-worklet.js`)
  - 2 Perf debug tools (`./perf-debug.js`, `./perf-debug.css`)
  - 7 SVG instrument assets in `./assets/instruments/`
  - Zero missing assets verified on disk.

## 6. Persistence & Storage Namespaces (Reconciled with V39)
- **IndexedDB**:
  - `musicandbeats-v3` (Store: `projects`, key `'last'`)
- **localStorage Keys**:
  - `musicandbeats:expression:play`
  - `musicandbeats:expression:record`
  - `musicandbeats:v18:latch:smart`
  - `musicandbeats:v18:latch:bass`
  - `musicandbeats:v18:playbeat`
  - `musicandbeats:v19:rack:<context>`
  - `musicandbeats:v24:collapsed:<id>`
  - `musicandbeats:v25:drawer:<id>`
  - `musicandbeats:v33:displayed-octaves`
  - `musicandbeats:v34:looper`
  - `musicandbeats:v35:settings`
  - `musicandbeats:v35:projects` (includes `v37`, `v38`, and new `v39` snapshot data)
  - `musicandbeats:v35:autosave`
  - `musicandbeats:v37:settings`
  - `musicandbeats:v38:settings`
  - `musicandbeats:v39:settings` (NEW: stores `transpose`, `chords`, `chordsCustomized`, `chordKey`, `slide`, `glideMs`, `pitchRange`, `mod`, `leadVoice`)

## 7. Development and Debug Modules
- `perf-debug.js` (loaded conditionally when URL has `?debug=perf`)
- `perf-debug.css` (loaded conditionally when URL has `?debug=perf`)

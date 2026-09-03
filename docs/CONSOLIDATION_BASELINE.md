# Music & Beats — Consolidation Baseline

## 1. Baseline Git Information
- **Commit SHA**: `92266e42bbd9a58441f80ff832885d869b37b92d`
- **Commit Message**: `Merge V38 real Lead keyboard, samples and deep FX`
- **Safety Rollback Tag**: `pre-consolidation-v38`
- **Archive Branch**: `archive/v38-patch-runtime`
- **Refactoring Work Branch**: `refactor/runtime-consolidation`

## 2. Build Version
- **Build Version (`build-version.json`)**: `v38`
- **Description**: `chromatic piano/keytar Lead, 1-3 displayed octaves, GeneralUser GS sample voices, deep Web Audio effects rack, and project recall`
- **Published At**: `2026-08-28T23:58:00+05:30`

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

### Tertiary Loader (`v9.js` -> V10 through V38-stability)
When `v9.js` executes:
- Dynamically ensures CSS links:
  `['v10','v12','v14','v15','v16','v17','v18','v19','v22','v23','v24','v25','v26','v27','v28','v29','help','keyboard-ui','v34-looper','v35','v36','v37','v38']`
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

## 4. File Counts & Byte Metrics
- **Total Root JavaScript Files**: 47
- **Total Root CSS Files**: 33
- **Total JS Bytes**: 487,280 bytes (~476 KB)
- **Total CSS Bytes**: 183,095 bytes (~179 KB)
- **Total Code Volume**: 5,892 lines across 80 files
- **Total Runtime Scripts Executed**: 44 scripts (9 in HTML + v9.js + update-guard.js + 33 in v9 chain)
- **Total Runtime Stylesheets Injected**: 31 CSS files (7 in HTML + v9.css + 23 in v9 list)
- **`node --check` syntax status**: Passed 100% on all 47 JS files with zero syntax errors.

## 5. Service Worker Metrics (`sw.js`)
- **Cache Name**: `musicandbeats-v38`
- **Cached Assets Count**: 90 assets
  - 44 JS files
  - 32 CSS files
  - 1 HTML file (`./index.html`)
  - 1 Root path (`./`)
  - 1 Manifest (`./manifest.webmanifest`)
  - 1 Main icon (`./icon.svg`)
  - 1 AudioWorklet (`./recorder-worklet.js`)
  - 2 Perf debug tools (`./perf-debug.js`, `./perf-debug.css`)
  - 7 SVG instrument assets in `./assets/instruments/`

## 6. Persistence & Storage Namespaces
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
  - `musicandbeats:v35:projects`
  - `musicandbeats:v35:autosave`
  - `musicandbeats:v37:settings`
  - `musicandbeats:v38:settings`

## 7. Development and Debug Modules
- `perf-debug.js` (loaded conditionally when URL has `?debug=perf`)
- `perf-debug.css` (loaded conditionally when URL has `?debug=perf`)

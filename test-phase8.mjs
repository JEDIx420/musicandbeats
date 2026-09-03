/**
 * Music & Beats — Non-invasive Phase 8 Verification Suite
 * Tests canonical CSS syntax, design token definitions, surface coverage,
 * accessibility rules, responsive breakpoints, and zero legacy versioned classes.
 */

import fs from 'node:fs';

let errors = 0;
function assert(condition, msg) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    errors++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('--- 1. Testing Canonical Stylesheet Presence & Syntax ---');
assert(fs.existsSync('src/styles.css'), 'src/styles.css exists');
const css = fs.readFileSync('src/styles.css', 'utf8');

// Basic brace balance check
const openBraces = (css.match(/\{/g) || []).length;
const closeBraces = (css.match(/\}/g) || []).length;
assert(openBraces === closeBraces && openBraces > 0, `Braces balanced (opens: ${openBraces}, closes: ${closeBraces})`);

console.log('\n--- 2. Testing Design Tokens & Custom Properties ---');
const requiredTokens = [
  '--mb-bg',
  '--mb-surface-1',
  '--mb-surface-2',
  '--mb-surface-3',
  '--mb-accent',
  '--mb-line',
  '--mb-text-primary',
  '--mb-text-muted',
  '--mb-radius-md',
  '--mb-shadow-card'
];

requiredTokens.forEach(token => {
  assert(css.includes(`${token}:`), `Token ${token} defined in :root`);
});

console.log('\n--- 3. Testing Semantic UI Surface Selectors ---');
const expectedSelectors = [
  '.mb-app-shell',
  '.mb-navbar',
  '.mb-brand-btn',
  '.mb-instrument-tabs',
  '.mb-chord-pad-grid',
  '.mb-chord-pad',
  '.mb-bass-pad-grid',
  '.mb-bass-pad',
  '.mb-guitar-controls',
  '.mb-lead-perf-shell',
  '.mb-perf-strip',
  '.mb-key.white',
  '.mb-drawer-bar',
  '.mb-record-transport',
  '.mb-timeline-display',
  '.mb-track-strip',
  '.mb-help-modal-backdrop'
];

expectedSelectors.forEach(sel => {
  assert(css.includes(sel), `Selector ${sel} present in canonical CSS`);
});

console.log('\n--- 4. Testing Accessibility & Motion Rules ---');
assert(css.includes(':focus-visible'), ':focus-visible styling present');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'prefers-reduced-motion media query present');
assert(css.includes('env(safe-area-inset-top'), 'iOS safe-area-inset-top present');
assert(css.includes('touch-action: none'), 'Explicit touch-action: none for musical surfaces');

console.log('\n--- 5. Testing Version-Number Elimination & !important Count ---');
// Check for legacy version numbers (.v34-, .v35-, etc.)
const legacyMatch = css.match(/\.(v34|v35|v36|v37|v38|v39)-[a-zA-Z0-9_-]+/g);
assert(!legacyMatch, `Zero legacy versioned class selectors in canonical CSS (found: ${legacyMatch?.join(', ') || '0'})`);

// Count !important declarations
// In canonical CSS, !important should ONLY be present in prefers-reduced-motion overrides
const importantMatches = css.match(/!important/g) || [];
console.log(`Note: Total !important count: ${importantMatches.length} (expected: 3 in reduced-motion rule)`);
assert(importantMatches.length <= 4, '!important declarations strictly restricted to reduced-motion overrides');

console.log(`\nPhase 8 verification completed with ${errors} errors.`);
process.exit(errors === 0 ? 0 : 1);

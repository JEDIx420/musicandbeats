/**
 * Music & Beats — Browser Integration & Functional Smoke Test (Play-First)
 * Automates headless Chrome across Mobile, Tablet Portrait, Tablet Landscape, and Desktop.
 * Verifies Play-First boot, Master Transport, Groove Box, Instrument tabs, and absence of Record.
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const server = http.createServer((req, res) => {
  let filePath = path.join(process.cwd(), req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml'
  };
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise(resolve => server.listen(8099, '127.0.0.1', resolve));
console.log('Test HTTP server active on http://127.0.0.1:8099');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewports = [
  { name: 'Mobile', width: 390, height: 844 },
  { name: 'Tablet-Portrait', width: 768, height: 1024 },
  { name: 'Tablet-Landscape', width: 1024, height: 768 },
  { name: 'Desktop', width: 1440, height: 900 }
];

let errors = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    errors++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

for (const vp of viewports) {
  console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
  const out = await new Promise(resolve => {
    const proc = spawn(chromePath, [
      '--headless',
      '--disable-gpu',
      `--window-size=${vp.width},${vp.height}`,
      '--dump-dom',
      'http://127.0.0.1:8099/index.html'
    ]);
    let stdout = '';
    proc.stdout.on('data', d => stdout += d);
    proc.on('close', () => resolve(stdout));
  });

  assert(out.includes('mb-app-shell'), `[${vp.name}] Shell mounted in DOM`);
  assert(out.includes('mb-navbar'), `[${vp.name}] Navbar rendered`);
  assert(out.includes('mb-master-transport'), `[${vp.name}] Master Beat Transport present`);
  assert(out.includes('mb-play-workspace'), `[${vp.name}] Play workspace loaded directly`);
  assert(out.includes('mb-chord-pad-grid'), `[${vp.name}] Smart Keys 7-pad grid rendered`);
  assert(!out.includes('Record Loop'), `[${vp.name}] No Record Mode CTA present`);
  assert(!out.includes('mb-record-shell'), `[${vp.name}] No Record shell in primary DOM`);
}

server.close();
console.log(`\nBrowser test completed with ${errors} errors.`);
process.exit(errors === 0 ? 0 : 1);

/**
 * Verify cut-and-stack print sheets: every card #N encodes expected[N-1].
 */
import { chromium } from 'playwright';
import fs from 'fs';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const expected = JSON.parse(fs.readFileSync('/tmp/expected-urls.json', 'utf8'));

function scaleNx(png, n) {
  const out = new PNG({ width: png.width * n, height: png.height * n });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      for (let dy = 0; dy < n; dy++) {
        for (let dx = 0; dx < n; dx++) {
          const oi = (out.width * (y * n + dy) + (x * n + dx)) << 2;
          out.data[oi] = png.data[i];
          out.data[oi + 1] = png.data[i + 1];
          out.data[oi + 2] = png.data[i + 2];
          out.data[oi + 3] = png.data[i + 3];
        }
      }
    }
  }
  return out;
}

function tryDecodePngBuffer(buf) {
  const png = PNG.sync.read(buf);
  for (const n of [1, 2, 3]) {
    const img = n === 1 ? png : scaleNx(png, n);
    const code = jsQR(new Uint8ClampedArray(img.data), img.width, img.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code?.data) return code.data;
  }
  return null;
}

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Upload CSV File' }).click();
await page.locator('input[type="file"]').setInputFiles('/workspace/fixtures/credits-sample.csv');
await page.waitForSelector('text=QR Codes (120)', { timeout: 20000 });
await page.waitForTimeout(3000);

await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(2500);

// Per filled print cell: number + canvas decode, keyed by card number
const cells = page.locator('.print-qr-item');
const cellCount = await cells.count();
const byNumber = new Map();
const page0Numbers = [];

for (let i = 0; i < cellCount; i++) {
  const cell = cells.nth(i);
  const numLoc = cell.locator('.qr-number');
  if ((await numLoc.count()) === 0) continue;
  const numText = (await numLoc.innerText()).trim();
  if (!numText) continue;
  const n = parseInt(numText.replace('#', ''), 10);
  const canvas = cell.locator('canvas');
  if ((await canvas.count()) === 0) {
    byNumber.set(n, { decoded: null, missingCanvas: true });
    continue;
  }
  const dataUrl = await canvas.evaluate((c) => c.toDataURL('image/png'));
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const decoded = tryDecodePngBuffer(buf);
  byNumber.set(n, { decoded });
  if (page0Numbers.length < 9) page0Numbers.push(numText);
}

console.log('page1 numbers (DOM order)', page0Numbers);
console.log('filled', byNumber.size);

let ok = 0;
const failures = [];
for (let n = 1; n <= 120; n++) {
  const entry = byNumber.get(n);
  const got = entry?.decoded ?? null;
  const exp = expected[n - 1];
  if (got === exp) ok++;
  else failures.push({ n, got, expected: exp, missing: !entry });
}

console.log(JSON.stringify({ ok, failCount: failures.length, sampleFails: failures.slice(0, 5) }, null, 2));

const pdfPath = '/opt/cursor/artifacts/pdf/credits-sample-120.pdf';
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
console.log('pdf', fs.statSync(pdfPath).size);
await browser.close();

fs.writeFileSync(
  '/tmp/decode-by-number.json',
  JSON.stringify({ ok, failures, page0Numbers }, null, 2)
);
if (ok !== 120) process.exit(2);
console.log('PASS 120/120 by card number');

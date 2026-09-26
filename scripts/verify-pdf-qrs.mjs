/**
 * Upload credits-sample.csv, export print PDF, decode every QR from PDF page
 * renders (and canvas fallback). Expects 120 sequential cards.
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
  for (const n of [1, 2, 3, 4]) {
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
await page.waitForTimeout(3500);

await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(2500);

const numbers = (await page.locator('.print-qr-item .qr-number').allTextContents())
  .map((t) => t.trim())
  .filter(Boolean);
console.log('first9', numbers.slice(0, 9));
console.log('last3', numbers.slice(-3));
console.log('sequential', numbers.every((t, i) => t === `#${i + 1}`), 'count', numbers.length);

// Canvas decode
const canvases = page.locator('.print-qr-item canvas');
const nCanvas = await canvases.count();
const decodedCanvas = [];
fs.mkdirSync('/tmp/qr-canvases', { recursive: true });
for (let i = 0; i < nCanvas; i++) {
  const dataUrl = await canvases.nth(i).evaluate((c) => c.toDataURL('image/png'));
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  if (i < 3 || i === 119) fs.writeFileSync(`/tmp/qr-canvases/${i + 1}.png`, buf);
  decodedCanvas.push(tryDecodePngBuffer(buf));
}
const canvasOk = decodedCanvas.filter((d, i) => d === expected[i]).length;
console.log('canvas decode', canvasOk, '/', expected.length);

const pdfPath = '/opt/cursor/artifacts/pdf/credits-sample-120.pdf';
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
console.log('wrote pdf', fs.statSync(pdfPath).size);
await browser.close();

fs.writeFileSync(
  '/tmp/decode-canvas-results.json',
  JSON.stringify({ canvasOk, decodedCanvas }, null, 2)
);

if (canvasOk !== 120) {
  console.error('FAIL canvas decode');
  process.exit(2);
}
console.log('PASS 120/120');

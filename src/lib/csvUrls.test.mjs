/**
 * Lightweight Node tests for CSV URL extraction (no test runner dependency).
 * Run: node --experimental-vm-modules --import tsx src/lib/csvUrls.test.mjs
 * or via: npm run test:csv
 */
import assert from 'node:assert/strict';
import {
  detectHeaderRow,
  extractUrlsFromCsv,
  findUrlColumnIndex,
  isUrlHintHeader,
  looksLikeUrl,
  normalizeCsvUrl,
} from './csvUrls.ts';

function section(name) {
  console.log(`\n▸ ${name}`);
}

section('looksLikeUrl');
assert.equal(looksLikeUrl('https://cursor.com/referral?code=ABC'), true);
assert.equal(looksLikeUrl('http://example.com'), true);
assert.equal(looksLikeUrl('cursor.com/referral?code=ABC'), true);
assert.equal(looksLikeUrl('www.example.com/path'), true);
assert.equal(looksLikeUrl('referral?code=ABC'), true);
assert.equal(looksLikeUrl('YAHYA-K8X17RIUV3CP'), false);
assert.equal(looksLikeUrl('Code'), false);
assert.equal(looksLikeUrl(''), false);

section('isUrlHintHeader');
assert.equal(isUrlHintHeader('URL'), true);
assert.equal(isUrlHintHeader('url'), true);
assert.equal(isUrlHintHeader('Link'), true);
assert.equal(isUrlHintHeader('referral_url'), true);
assert.equal(isUrlHintHeader('Code'), false);
assert.equal(isUrlHintHeader('Yahya'), false);

section('normalizeCsvUrl');
assert.equal(
  normalizeCsvUrl('referral?code=ABC'),
  'https://cursor.com/referral?code=ABC'
);
assert.equal(
  normalizeCsvUrl('https://cursor.com/referral?code=ABC'),
  'https://cursor.com/referral?code=ABC'
);

section('multi-column Code,URL sample (header skip + URL column)');
{
  const csv = [
    'Code,URL',
    'YAHYA-K8X17RIUV3CP,https://cursor.com/referral?code=YAHYA-K8X17RIUV3CP',
    'YAHYA-OTHERCODE,https://cursor.com/referral?code=YAHYA-OTHERCODE',
  ].join('\n');
  const result = extractUrlsFromCsv(csv);
  assert.equal(result.skippedHeader, true);
  assert.equal(result.urlColumnIndex, 1);
  assert.equal(result.urls.length, 2);
  assert.equal(
    result.urls[0],
    'https://cursor.com/referral?code=YAHYA-K8X17RIUV3CP'
  );
}

section('header named after a person (not Code/URL) still works via value shape');
{
  const csv = [
    'Yahya,Something',
    'YAHYA-AAA,https://cursor.com/referral?code=YAHYA-AAA',
    'YAHYA-BBB,https://cursor.com/referral?code=YAHYA-BBB',
  ].join('\n');
  const result = extractUrlsFromCsv(csv);
  assert.equal(result.skippedHeader, true);
  assert.equal(result.urlColumnIndex, 1);
  assert.equal(result.urls.length, 2);
  assert.equal(result.urls[0], 'https://cursor.com/referral?code=YAHYA-AAA');
}

section('single-column URLs without header (legacy)');
{
  const csv = [
    'https://cursor.com/referral?code=A',
    'https://cursor.com/referral?code=B',
  ].join('\n');
  const result = extractUrlsFromCsv(csv);
  assert.equal(result.skippedHeader, false);
  assert.equal(result.urls.length, 2);
  assert.equal(result.urls[0], 'https://cursor.com/referral?code=A');
}

section('single-column URLs with URL header (legacy)');
{
  const csv = ['URL', 'https://cursor.com/referral?code=A', 'https://example.com/b'].join(
    '\n'
  );
  const result = extractUrlsFromCsv(csv);
  assert.equal(result.skippedHeader, true);
  assert.equal(result.urls.length, 2);
  assert.equal(result.urls[0], 'https://cursor.com/referral?code=A');
}

section('quoted fields + CRLF');
{
  const csv =
    'Code,URL\r\n"YAHYA-AAA","https://cursor.com/referral?code=YAHYA-AAA"\r\n"YAHYA-BBB","https://cursor.com/referral?code=YAHYA-BBB"\r\n';
  const result = extractUrlsFromCsv(csv);
  assert.equal(result.urls.length, 2);
  assert.equal(result.urls[0], 'https://cursor.com/referral?code=YAHYA-AAA');
}

section('trailing blank lines ignored');
{
  const csv =
    'Code,URL\nYAHYA-AAA,https://cursor.com/referral?code=YAHYA-AAA\n\n\n';
  const result = extractUrlsFromCsv(csv);
  assert.equal(result.urls.length, 1);
}

section('bare referral path column rebuilt');
{
  const csv = ['id,path', '1,referral?code=ZZZ'].join('\n');
  const result = extractUrlsFromCsv(csv);
  assert.equal(result.urls[0], 'https://cursor.com/referral?code=ZZZ');
}

section('detectHeaderRow / findUrlColumnIndex helpers');
{
  const rows = [
    ['Code', 'URL'],
    ['AAA', 'https://cursor.com/referral?code=AAA'],
  ];
  assert.equal(detectHeaderRow(rows), true);
  assert.equal(findUrlColumnIndex(rows, true), 1);
}

section('120-row shaped sample count');
{
  const lines = ['Code,URL'];
  for (let i = 0; i < 120; i++) {
    const code = `YAHYA-CODE${String(i).padStart(3, '0')}`;
    lines.push(`${code},https://cursor.com/referral?code=${code}`);
  }
  const result = extractUrlsFromCsv(lines.join('\n'));
  assert.equal(result.urls.length, 120);
  assert.equal(
    result.urls[0],
    'https://cursor.com/referral?code=YAHYA-CODE000'
  );
}

console.log('\n✓ All csvUrls tests passed\n');

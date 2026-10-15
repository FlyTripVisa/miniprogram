import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('static assets and worker entrypoint are present', async () => {
  const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const ai = await readFile(new URL('../public/ai.html', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(index, /<html/i);
  assert.match(ai, /id="chatForm"/);
  assert.match(worker, /\/api\/chat/);
});

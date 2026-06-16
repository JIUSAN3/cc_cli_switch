import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyClaudeSettings, unapplyClaudeSettings } from '../src/claude-settings.js';

test('applies env values while preserving existing settings', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ccswitch-settings-'));
  try {
    const file = path.join(dir, 'settings.json');
    await writeFile(file, JSON.stringify({
      theme: 'dark',
      env: {
        KEEP_ME: 'yes',
        ANTHROPIC_BASE_URL: 'old'
      }
    }));

    const result = await applyClaudeSettings({
      ANTHROPIC_BASE_URL: 'https://gateway.example.com',
      ANTHROPIC_AUTH_TOKEN: 'secret'
    }, { file });

    const next = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(next.theme, 'dark');
    assert.equal(next.env.KEEP_ME, 'yes');
    assert.equal(next.env.ANTHROPIC_BASE_URL, 'https://gateway.example.com');
    assert.equal(next.env.ANTHROPIC_AUTH_TOKEN, 'secret');
    assert.ok(result.backup);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('unapply removes only ccswitch Claude env values', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ccswitch-settings-'));
  try {
    const file = path.join(dir, 'settings.json');
    await writeFile(file, JSON.stringify({
      env: {
        KEEP_ME: 'yes',
        ANTHROPIC_BASE_URL: 'https://gateway.example.com',
        ANTHROPIC_AUTH_TOKEN: 'secret'
      }
    }));

    await unapplyClaudeSettings({ file });

    const next = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(next.env, { KEEP_ME: 'yes' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

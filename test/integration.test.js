import test from 'node:test';
import assert from 'node:assert/strict';
import { managedShellBlock, renderShellInit } from '../src/integration.js';

test('renders bash helper functions', () => {
  const out = renderShellInit('bash');
  assert.match(out, /ccuse\(\)/);
  assert.match(out, /ccswitch env "\$1" --shell bash/);
  assert.match(out, /ccunset\(\)/);
});

test('renders powershell helper functions', () => {
  const out = renderShellInit('powershell');
  assert.match(out, /function ccuse\(\$name\)/);
  assert.match(out, /Invoke-Expression/);
});

test('wraps integration in a managed block', () => {
  const out = managedShellBlock('bash');
  assert.match(out, />>> ccswitch shell integration >>>/);
  assert.match(out, /<<< ccswitch shell integration <<</);
});

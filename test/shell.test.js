import test from 'node:test';
import assert from 'node:assert/strict';
import { renderShellEnv, renderUnset } from '../src/shell.js';

test('renders posix env with safe single quote escaping', () => {
  const out = renderShellEnv({ A: "x y ' z", B: '$HOME' }, 'bash');
  assert.match(out, /export A='x y '\\'' z'/);
  assert.match(out, /export B='\$HOME'/);
});

test('renders powershell env', () => {
  const out = renderShellEnv({ A: "can't" }, 'powershell');
  assert.equal(out.trim(), "$env:A = 'can''t'");
});

test('renders unset for fish', () => {
  assert.equal(renderUnset(['A', 'B'], 'fish'), 'set -e A;\nset -e B;\n');
});

test('renders cmd env with metacharacter escaping', () => {
  const out = renderShellEnv({ A: 'x%PATH%!y^z&ok' }, 'cmd');
  assert.equal(out.trim(), 'set "A=x^%PATH^%^^!y^^z&ok"');
});

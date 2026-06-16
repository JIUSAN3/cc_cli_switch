#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((error) => {
  const json = process.argv.includes('--json');
  if (json) {
    console.error(JSON.stringify({
      ok: false,
      error: {
        code: error.code || 'ERROR',
        message: error.message
      }
    }, null, 2));
  } else {
    console.error(`ccswitch: ${error.message}`);
  }
  process.exit(error.exitCode || 1);
});

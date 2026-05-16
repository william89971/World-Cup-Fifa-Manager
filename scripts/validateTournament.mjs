import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

const outputDir = join(tmpdir(), 'codex-futbol-validation');
const outputFile = join(outputDir, 'validateTournament.mjs');

await mkdir(outputDir, { recursive: true });
await build({
  entryPoints: ['src/dev/validateTournament.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outputFile,
  logLevel: 'silent',
});

const { runTournamentValidation } = await import(`file://${outputFile}?t=${Date.now()}`);
const issues = runTournamentValidation();

if (issues.length > 0) {
  console.error('Tournament validation failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log('Tournament validation passed.');
}

await writeFile(join(outputDir, 'last-run.txt'), new Date().toISOString());

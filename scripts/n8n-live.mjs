import { spawn } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  assertLoadedTypes,
  ensureNode22,
  ensureStack,
  n8nVersion,
  root,
  run,
} from './n8n-live-lib.mjs';
import { sampleWorkflows } from './sample-workflows.mjs';

ensureNode22();

const mode = process.argv[2] ?? 'start';
const liveDir = path.join(root, '.n8n-live');
const port = process.env.N8N_PORT ?? '5678';
const timeoutMs = Number(process.env.N8N_LIVE_TIMEOUT_MS ?? 180_000);

async function writeSampleWorkflows(workflowsDir) {
  await mkdir(workflowsDir, { recursive: true });
  for (const { file, workflow } of sampleWorkflows) {
    writeFileSync(path.join(workflowsDir, file), `${JSON.stringify(workflow, null, 2)}\n`);
  }
}

function shouldImportSamples(workflowsDir, userFolder) {
  const marker = path.join(liveDir, '.workflows-imported');
  const dbPath = path.join(userFolder, '.n8n', 'database.sqlite');

  if (!existsSync(marker) || !existsSync(dbPath)) return true;

  const markerTime = statSync(marker).mtimeMs;
  if (statSync(dbPath).mtimeMs > markerTime) return true;

  for (const { file } of sampleWorkflows) {
    const workflowFile = path.join(workflowsDir, file);
    if (existsSync(workflowFile) && statSync(workflowFile).mtimeMs > markerTime) return true;
  }

  return false;
}

async function importSamplesIfNeeded({ bin, runnerDir, n8nEnv, workflowsDir, userFolder }) {
  if (!shouldImportSamples(workflowsDir, userFolder)) return;

  console.log('Importing sample DoneThat workflows…');
  await run(process.execPath, [bin, 'import:workflow', '--separate', `--input=${workflowsDir}`], {
    cwd: runnerDir,
    env: n8nEnv,
  });
  writeFileSync(path.join(liveDir, '.workflows-imported'), new Date().toISOString());
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port: p } = server.address();
      server.close(() => resolve(p));
    });
    server.on('error', reject);
  });
}

async function start() {
  console.log('Building DoneThat node…');
  await run('npm', ['run', 'build']);

  const stack = await ensureStack({
    baseDir: liveDir,
    port,
    encryptionKey: process.env.N8N_ENCRYPTION_KEY ?? 'donethat-local-live-development-key',
  });

  const workflowsDir = path.join(liveDir, 'workflows');
  await writeSampleWorkflows(workflowsDir);
  await importSamplesIfNeeded({ ...stack, workflowsDir, userFolder: stack.userFolder });

  console.log(`\nStarting n8n ${n8nVersion} at http://127.0.0.1:${port}`);
  console.log('Press Ctrl+C to stop.\n');
  await run(process.execPath, [stack.bin, 'start'], { cwd: stack.runnerDir, env: stack.n8nEnv });
}

async function test() {
  await run('npm', ['run', 'build']);

  const workDir = await mkdtemp(path.join(tmpdir(), 'donethat-n8n-test-'));
  const port = await freePort();
  const brokerPort = await freePort();

  const stack = await ensureStack({
    baseDir: workDir,
    port,
    encryptionKey: 'donethat-live-test-encryption-key',
  });

  const n8nEnv = {
    ...stack.n8nEnv,
    N8N_RUNNERS_BROKER_PORT: String(brokerPort),
    N8N_RUNNERS_BROKER_LISTEN_ADDRESS: '127.0.0.1',
  };

  console.log(`Starting n8n@${n8nVersion} on 127.0.0.1:${port}…`);
  const n8n = spawn(process.execPath, [stack.bin, 'start'], {
    cwd: stack.runnerDir,
    env: { ...process.env, ...n8nEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  const append = (chunk) => {
    output += chunk.toString();
    if (output.length > 30_000) output = output.slice(-30_000);
  };
  n8n.stdout.on('data', append);
  n8n.stderr.on('data', append);

  const stop = async () => {
    if (n8n.exitCode !== null) return;
    n8n.kill('SIGINT');
    await new Promise((r) => setTimeout(r, 15_000));
    if (n8n.exitCode === null) n8n.kill('SIGTERM');
  };

  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (n8n.exitCode !== null) throw new Error(`n8n exited (${n8n.exitCode})\n${output}`);

      try {
        const ok = await fetch(`http://127.0.0.1:${port}/healthz`).then((r) => r.ok);
        if (ok && assertLoadedTypes(stack.userFolder)) {
          console.log('Live n8n test OK (DoneThat node + credentials loaded)');
          return;
        }
      } catch {
        /* not ready */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`Timed out waiting for DoneThat node\n${output}`);
  } finally {
    await stop();
  }
}

const handlers = { start, test };
if (!handlers[mode]) {
  console.error('Usage: node scripts/n8n-live.mjs <start|test>');
  process.exit(1);
}

handlers[mode]().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});

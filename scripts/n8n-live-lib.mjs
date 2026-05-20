import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const n8nVersion = process.env.N8N_LIVE_VERSION ?? '2.21.4';

const MIN_NODE = [22, 16];

export function ensureNode22() {
  if (process.env.N8N_LIVE_REEXEC === '1') return;
  if (process.env.N8N_LIVE_ALLOW_OLDER_NODE === 'true') return;

  const match = /^v?(\d+)\.(\d+)/.exec(process.version);
  if (!match) return;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1])) return;

  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (!home) {
    throw new Error(`n8n needs Node >=${MIN_NODE[0]}.${MIN_NODE[1]} (current: ${process.version})`);
  }

  const nvmRoot = path.join(home, '.nvm/versions/node');
  if (!existsSync(nvmRoot)) {
    throw new Error(`n8n needs Node >=${MIN_NODE[0]}.${MIN_NODE[1]}. Install Node 22 (e.g. nvm install 22).`);
  }

  const node22 = readdirSync(nvmRoot)
    .filter((d) => /^v22\./.test(d))
    .sort()
    .reverse()
    .map((d) => path.join(nvmRoot, d, 'bin/node'))
    .find((bin) => existsSync(bin));

  if (!node22) {
    throw new Error(`n8n needs Node >=${MIN_NODE[0]}.${MIN_NODE[1]}. Run: nvm install 22`);
  }

  const child = spawnSync(node22, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, N8N_LIVE_REEXEC: '1' },
  });
  process.exit(child.status ?? 1);
}

export function npmEnv(baseDir) {
  return {
    PATH: [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
    npm_config_cache: path.join(baseDir, 'npm-cache'),
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  };
}

export function run(command, commandArgs, { cwd = root, env, stdio = 'inherit' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: { ...process.env, ...env },
      stdio: stdio === 'pipe' ? ['ignore', 'pipe', 'pipe'] : stdio,
    });

    let output = '';
    if (stdio === 'pipe') {
      const append = (chunk) => {
        output += chunk.toString();
        if (output.length > 20_000) output = output.slice(-20_000);
      };
      child.stdout.on('data', append);
      child.stderr.on('data', append);
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${commandArgs.join(' ')} failed (${code})\n${output}`));
    });
  });
}

export function n8nBin(runnerDir) {
  return path.join(runnerDir, 'node_modules/n8n/bin/n8n');
}

function n8nWorks(runnerDir) {
  const result = spawnSync(process.execPath, [n8nBin(runnerDir), 'start', '--help'], {
    cwd: runnerDir,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return result.status === 0;
}

function customInstallIsBroken(customDir) {
  const pkgRoot = path.join(customDir, 'node_modules/n8n-nodes-donethat');
  return existsSync(path.join(pkgRoot, '.n8n-live'));
}

export async function ensureStack({ baseDir, port = '5678', encryptionKey }) {
  const runnerDir = path.join(baseDir, 'runner');
  const customDir = path.join(baseDir, 'custom');
  const userFolder = path.join(baseDir, 'user');
  const packDir = path.join(baseDir, 'pack');
  const versionMarker = path.join(baseDir, '.n8n-version');
  const envBase = npmEnv(baseDir);

  await mkdir(baseDir, { recursive: true });
  await mkdir(userFolder, { recursive: true });
  await mkdir(path.join(baseDir, 'npm-cache'), { recursive: true });

  if (customInstallIsBroken(customDir)) {
    rmSync(path.join(customDir, 'node_modules'), { recursive: true, force: true });
  }

  const needsN8n =
    !existsSync(versionMarker) ||
    readFileSync(versionMarker, 'utf8').trim() !== n8nVersion ||
    !n8nWorks(runnerDir);

  if (needsN8n) {
    rmSync(runnerDir, { recursive: true, force: true });
    await mkdir(runnerDir, { recursive: true });
    writeFileSync(
      path.join(runnerDir, 'package.json'),
      JSON.stringify({ name: 'donethat-n8n-runner', private: true }, null, 2),
    );
    console.log(`Installing n8n@${n8nVersion}…`);
    await run(
      'npm',
      ['install', `n8n@${n8nVersion}`, '--no-audit', '--no-fund'],
      { cwd: runnerDir, env: envBase },
    );
    if (!n8nWorks(runnerDir)) {
      throw new Error(`n8n install failed in ${runnerDir}`);
    }
    writeFileSync(versionMarker, n8nVersion);
  }

  rmSync(path.join(customDir, 'node_modules'), { recursive: true, force: true });
  await mkdir(customDir, { recursive: true });
  await mkdir(packDir, { recursive: true });
  writeFileSync(
    path.join(customDir, 'package.json'),
    JSON.stringify({ name: 'donethat-n8n-custom', private: true }, null, 2),
  );

  console.log('Installing DoneThat node…');
  const packOutput = await run('npm', ['pack', '--pack-destination', packDir], {
    cwd: root,
    env: envBase,
    stdio: 'pipe',
  });
  const tarball = packOutput
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .findLast((line) => /^n8n-nodes-donethat-.+\.tgz$/.test(line));
  if (!tarball) throw new Error(`npm pack failed\n${packOutput}`);

  await run(
    'npm',
    ['install', path.join(packDir, tarball), '--omit=dev', '--legacy-peer-deps', '--no-audit', '--no-fund'],
    { cwd: customDir, env: envBase },
  );

  const n8nEnv = {
    ...envBase,
    N8N_USER_FOLDER: userFolder,
    N8N_CUSTOM_EXTENSIONS: customDir,
    N8N_PORT: String(port),
    N8N_HOST: '127.0.0.1',
    N8N_LISTEN_ADDRESS: '127.0.0.1',
    N8N_PROTOCOL: 'http',
    N8N_SECURE_COOKIE: 'false',
    N8N_DIAGNOSTICS_ENABLED: 'false',
    N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
    N8N_TEMPLATES_ENABLED: 'false',
    N8N_PERSONALIZATION_ENABLED: 'false',
    N8N_PYTHON_ENABLED: 'false',
    N8N_ENCRYPTION_KEY: encryptionKey,
  };

  return { runnerDir, customDir, userFolder, n8nEnv, bin: n8nBin(runnerDir) };
}

export function assertLoadedTypes(userFolder) {
  const typesDir = path.join(userFolder, '.cache/n8n/public/types');
  const nodesFile = path.join(typesDir, 'nodes.json');
  const credentialsFile = path.join(typesDir, 'credentials.json');
  if (!existsSync(nodesFile) || !existsSync(credentialsFile)) return false;

  const nodes = JSON.parse(readFileSync(nodesFile, 'utf8'));
  const credentials = JSON.parse(readFileSync(credentialsFile, 'utf8'));
  const node = nodes.find((n) => n.name === 'CUSTOM.doneThat' && n.displayName === 'DoneThat');
  const cred = credentials.find(
    (c) => c.name === 'doneThatApi' && c.documentationUrl === 'https://donethat.ai/api-reference',
  );
  return Boolean(node && cred && node.credentials?.some((c) => c.name === 'doneThatApi'));
}

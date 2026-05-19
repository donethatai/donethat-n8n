/**
 * Post-build guard: n8n loads node/credential classes from package.json `n8n` paths.
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const require = createRequire(path.join(root, 'package.json'));

const errors = [];

for (const rel of [...(pkg.n8n?.nodes ?? []), ...(pkg.n8n?.credentials ?? [])]) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    errors.push(`missing build artifact: ${rel}`);
  }
}

const icon = path.join(root, 'dist/nodes/DoneThat/donethat.svg');
if (!existsSync(icon)) {
  errors.push('missing dist/nodes/DoneThat/donethat.svg');
}

for (const rel of pkg.n8n?.credentials ?? []) {
  const mod = require(path.join(root, rel));
  const Cred = mod.DoneThatApi;
  if (!Cred) {
    errors.push(`${rel} must export DoneThatApi class`);
    continue;
  }
  const instance = new Cred();
  if (instance.name !== 'doneThatApi') {
    errors.push('credential name must be doneThatApi');
  }
  if (!instance.test?.request?.url) {
    errors.push('credential missing test GET /projects');
  }
  if (instance.documentationUrl !== 'https://donethat.ai/api-reference') {
    errors.push(`credential documentationUrl must be public API reference, got ${instance.documentationUrl}`);
  }
}

for (const rel of pkg.n8n?.nodes ?? []) {
  const mod = require(path.join(root, rel));
  const Node = mod.DoneThat;
  if (!Node) {
    errors.push(`${rel} must export DoneThat class (not .default)`);
    continue;
  }
  const instance = new Node();
  if (instance.description?.name !== 'doneThat') {
    errors.push('node description.name must be doneThat');
  }
  if (!instance.methods?.loadOptions?.getProjects) {
    errors.push('node missing loadOptions.getProjects');
  }
}

if (errors.length > 0) {
  console.error('n8n package verification failed:\n', errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log('n8n package OK (DoneThat node + credentials, icon, auth test)');

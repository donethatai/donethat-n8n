import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  n8n: {nodes: string[]; credentials: string[]};
};

describe('n8n package build artifacts', () => {
  it('exposes node and credential classes from package.json paths', () => {
    for (const rel of [...packageJson.n8n.nodes, ...packageJson.n8n.credentials]) {
      expect(existsSync(path.join(root, rel))).toBe(true);
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const credMod = require(path.join(root, packageJson.n8n.credentials[0])) as {
      DoneThatApi: new () => {name: string; test: {request: {url: string}}};
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeMod = require(path.join(root, packageJson.n8n.nodes[0])) as {
      DoneThat: new () => {description: {name: string}};
    };

    expect(credMod.DoneThatApi).toBeDefined();
    expect((credMod as {default?: unknown}).default).toBeUndefined();
    expect(new credMod.DoneThatApi().name).toBe('doneThatApi');
    expect(new credMod.DoneThatApi().test.request.url).toBe('/user');

    expect(nodeMod.DoneThat).toBeDefined();
    expect(new nodeMod.DoneThat().description.name).toBe('doneThat');
  });
});

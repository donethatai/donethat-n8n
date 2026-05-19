import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const assets = [
  ['nodes/DoneThat/donethat.svg', 'dist/nodes/DoneThat/donethat.svg'],
];

await Promise.all(
  assets.map(async ([source, target]) => {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }),
);

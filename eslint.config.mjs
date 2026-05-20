// n8n's bundled ESLint flat config plus @n8n/community-nodes rules. This is
// what `@n8n/scan-community-package` runs against the published tarball, so
// running it locally catches submission-time failures before they ship.
import {config} from '@n8n/node-cli/eslint';
import {globalIgnores} from 'eslint/config';

export default [
  globalIgnores([
    'dist/**',
    'coverage/**',
    '.n8n-live/**',
    'test/**',
    'scripts/**',
    'node_modules/**',
  ]),
  ...config,
];

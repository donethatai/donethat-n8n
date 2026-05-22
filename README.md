# n8n-nodes-donethat

[![License: MIT](https://img.shields.io/github/license/donethatai/donethat-n8n)](LICENSE)
[![CI](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.16-339933?logo=node.js&logoColor=white)](package.json)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-FF6D5A?logo=n8n&logoColor=white)](https://docs.n8n.io/integrations/community-nodes/)

[DoneThat](https://donethat.ai) automatically tracks all work and uses this context to boost your productivity: automated timesheets, long-term memory for AIs, proactive coaching, and social sharing for accountability and remote trust. DoneThat is built privacy-first, cross-platform, and takes five minutes to set up.

This n8n community node exposes the DoneThat API: generate time-tracking reports, fetch AI summary messages, manage projects, and search across your activity and tasks.

API base: `https://api.donethat.ai`. Reference: [donethat.ai/api-reference](https://donethat.ai/api-reference).

## Resources

- **Report**: `Generate` (POST /report). Aggregation: `activity`, `day`, `task`, `week`. `minute` is a legacy alias for `activity`.
- **Summary message**: `Get` (GET /message).
- **Project**: `Get Many`, `Get`, `Create`, `Create or Update`, `Update`, `Archive`. No delete.
- **Search**: `Search` (POST /search). Sources: `tasks`, `activity`.

## Credential

Create an API key at https://app.donethat.ai → Settings → API Access. The credential test hits `GET /user`, so the key needs at least `user:read`. Operations need scopes matching the resource (`reports:read`, `projects:read`/`projects:write`, `search:read`, `messages:read`).

The Base URL field defaults to `https://api.donethat.ai`. Override only for testing.

## Development

```bash
npm install
npm run build && npm test
```

`npm run build` compiles to `dist/` and runs `scripts/verify-n8n-package.mjs`, which asserts the package contracts n8n loads (class names, credential test endpoint, icon presence). Tests depend on `dist/`, so the build must run first.

### Live n8n

`npm run n8n:live` builds the node, installs n8n into `.n8n-live/` (first run only, 1-2 GB), packs and loads this node, imports the workflows from `scripts/sample-workflows.mjs`, and starts n8n on http://127.0.0.1:5678. After code changes, rerun the same command.

`npm run test:live` is the headless variant used in CI: starts n8n in a temp dir and checks that the node and credentials appear in the n8n metadata.

Both scripts auto-switch to Node 22 via nvm (n8n 2.21+ needs ≥22.16). `.n8n-live/` is gitignored; `rm -rf .n8n-live` to reset.

Optional env: `N8N_LIVE_VERSION=2.21.4`, `N8N_PORT=5678`.

## License

MIT.

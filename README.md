# n8n-nodes-donethat

[![License: MIT](https://img.shields.io/github/license/donethatai/donethat-n8n)](LICENSE)
[![CI](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/donethatai/donethat-n8n/branch/main/graph/badge.svg)](https://codecov.io/gh/donethatai/donethat-n8n)
[![Node](https://img.shields.io/badge/node-%3E%3D22.16-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-FF6D5A?logo=n8n&logoColor=white)](https://docs.n8n.io/integrations/community-nodes/)

Community [n8n](https://n8n.io) node for [DoneThat](https://donethat.ai). Uses API keys from **Settings → API Access**.

- **API base URL (HTTP):** `https://api.donethat.ai`
- **API reference (docs):** [donethat.ai/api-reference](https://donethat.ai/api-reference)

## Resources

| Resource | Operations | API |
| :--- | :--- | :--- |
| **Report** | Generate | `POST /report` (`activity`, `day`, `task`, `week`; `minute` = legacy alias for `activity`) |
| **Summary message** | Get | `GET /message` |
| **Project** | List, get, create, update, archive | `GET/POST /projects` (no delete) |
| **Search** | Search | `POST /search` (`tasks`, `activity`; `screenshots` = legacy alias for `activity`) |

## Credentials

| Field | Purpose |
| :--- | :--- |
| **API key** | From https://app.donethat.ai → Settings → API Access |
| **Base URL** | `https://api.donethat.ai` (override only for testing) |

Credential test: `GET /user`.

## Example workflow

Generate a 7-day report aggregated by day:

```json
{
  "name": "DoneThat - Last 7 Days by Day",
  "nodes": [
    { "name": "Run manually", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {} },
    {
      "name": "DoneThat",
      "type": "n8n-nodes-donethat.doneThat",
      "typeVersion": 1,
      "position": [320, 0],
      "credentials": { "doneThatApi": { "id": "1", "name": "DoneThat API" } },
      "parameters": {
        "resource": "report",
        "operation": "generate",
        "startDate": "={{$today.minus({days: 7}).toISODate()}}",
        "endDate": "={{$today.toISODate()}}",
        "aggregationLevel": "day",
        "reportOptions": { "includeCategories": true, "includeProjects": true, "sort": "desc" }
      }
    }
  ],
  "connections": { "Run manually": { "main": [[{ "node": "DoneThat", "type": "main", "index": 0 }]] } }
}
```

Two larger sample workflows ship in `scripts/sample-workflows.mjs` and are loaded automatically by `npm run n8n:live` for hands-on testing: one covers all read-only endpoints, the other creates → updates → archives a project.

### API key scopes

| Scope | Used for |
| :--- | :--- |
| `user:read` | Credential test |
| `reports:read` | Reports |
| `messages:read` or `reports:read` | Summary messages |
| `projects:read` | List/get projects |
| `projects:write` | Create, update, archive (includes read) |
| `search:read` | Search |

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

`npm run build` runs `scripts/verify-n8n-package.mjs` to confirm compiled node/credential classes, the icon asset, and credential test (`GET /user`) match what n8n loads from `package.json`.

### Live testing

Two commands exercise a real n8n instance with this package loaded. Both pick **Node 22** from nvm automatically when your shell is on an older Node (n8n 2.21 needs Node ≥22.16). Install Node 22 if needed: `nvm install 22`.

| Command | What it does |
| :--- | :--- |
| `npm run n8n:live` | **Interactive dev.** Builds the node, installs n8n once under `.n8n-live/` (~1–2 GB disk; first run takes several minutes), loads the packed DoneThat node, imports two sample workflows, starts n8n at **http://127.0.0.1:5678**. Add a DoneThat API credential in the UI, then run the workflows. Press Ctrl+C to stop. |
| `npm run test:live` | **CI smoke test.** Same install flow in a temp directory, starts n8n, checks `/healthz` and that the DoneThat node + credentials appear in n8n metadata, then exits. No browser needed. |

After you change node code, run `npm run build` and `npm run n8n:live` again so the custom extension is repacked and reloaded.

Optional env vars:

- `N8N_LIVE_VERSION=2.21.4`: n8n version to install (default: latest on npm, currently 2.21.4)
- `N8N_PORT=5678`: port for `n8n:live` only

`.n8n-live/` is gitignored (n8n install, user DB, caches). Delete it to free disk or reset local state: `rm -rf .n8n-live`.

### Install in n8n (production-like)

```bash
npm run build
# Link or copy into your n8n custom nodes directory, then restart n8n.
```

See [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

## Repository layout

- `credentials/DoneThatApi.credentials.ts` – API key auth + connection test
- `nodes/DoneThat/DoneThat.node.ts` – node UI and execution
- `nodes/DoneThat/request.ts` – HTTP request builders (unit-tested)
- `nodes/DoneThat/response.ts` – API envelope → n8n items
- `nodes/DoneThat/projects.ts` – project dropdown (`loadOptions`)

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT – see [LICENSE](LICENSE).

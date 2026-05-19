# n8n-nodes-donethat

[![License: MIT](https://img.shields.io/github/license/donethatai/donethat-n8n)](LICENSE)
[![CI](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/donethatai/donethat-n8n/branch/main/graph/badge.svg)](https://codecov.io/gh/donethatai/donethat-n8n)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
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
| **Connection name** | Friendly label in n8n (not a URL) |
| **API key** | From https://donethat.ai → Settings → API Access |
| **Base URL** | `https://api.donethat.ai` (override only for testing) |

Credential test: `GET /projects`.

### API key scopes

| Scope | Used for |
| :--- | :--- |
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

`npm run build` runs `scripts/verify-n8n-package.mjs` to confirm compiled node/credential classes, the icon asset, and credential test (`GET /projects`) match what n8n loads from `package.json`.

### Install in n8n (local)

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

## License

MIT – see [LICENSE](LICENSE).

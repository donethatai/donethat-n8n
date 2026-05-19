# n8n-nodes-donethat

[![License: MIT](https://img.shields.io/github/license/donethatai/donethat-n8n)](LICENSE)
[![CI](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/donethatai/donethat-n8n/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/donethatai/donethat-n8n/branch/main/graph/badge.svg)](https://codecov.io/gh/donethatai/donethat-n8n)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-FF6D5A?logo=n8n&logoColor=white)](https://docs.n8n.io/integrations/community-nodes/)

Community n8n node for [DoneThat](https://donethat.ai).

## Operations

- **Report** — `POST /report` (aggregation: activity, day, task, week; `minute` is a legacy alias for activity)
- **Summary message** — `GET /message`
- **Project** — `GET/POST /projects` (list, get, create, update, archive; delete is not supported by the API)
- **Search** — `POST /search` (sources: `tasks`, `activity`; `screenshots` is a legacy alias for activity)

API base URL: `https://api.donethat.ai`

## Credentials

Create an API key in DoneThat under **Settings → API Access**.

| Scope | Used for |
| :--- | :--- |
| `reports:read` | Reports |
| `messages:read` or `reports:read` | Summary messages |
| `projects:read` | List/get projects |
| `projects:write` | Create, update, archive (includes read) |
| `search:read` | Search |

The credential test calls `GET /projects`.

## Development

```bash
npm install
npm run build
npm test
```

Link the built package into your n8n custom extensions directory.

## License

MIT

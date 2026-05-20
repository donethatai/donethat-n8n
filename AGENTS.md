# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

n8n community node package (`n8n-nodes-donethat`) wrapping the DoneThat API. Single node (`DoneThat`) with four resources (`report`, `message`, `project`, `search`) plus a credential (`DoneThatApi`). Goal is acceptance into n8n's verified-community-nodes registry.

## Commands

Node 22.16+ is required (see `.nvmrc`, `package.json#engines`). `npm run n8n:live` and `npm run test:live` auto-switch to Node 22 via nvm; everything else assumes you're already on it.

| Command | Notes |
| :--- | :--- |
| `npm run build` | Compiles to `dist/`, copies the SVG icon, then runs `scripts/verify-n8n-package.mjs` which fails the build if the n8n contracts below drift. |
| `npm run lint` | Local ESLint flat config (`eslint.config.cjs`); typescript-eslint recommended + recommended-requiring-type-checking + prettier. |
| `npm test` | Runs `npm run build` first, then Jest. Tests rely on `dist/` so you cannot skip the build. |
| `npx jest test/request.test.ts -t "report"` | Run a single test file or pattern. |
| `npm run n8n:live` | Builds, installs a real n8n into `.n8n-live/` on first run (~1 to 2 GB, several minutes), packs this node, imports sample workflows, starts n8n at http://127.0.0.1:5678. After code changes rerun this whole command to repack. |
| `npm run test:live` | Headless variant: same install, asserts `/healthz` plus that the node/credentials appear in n8n metadata. Used in CI. |
| `npm run release` | Interactive release-it flow via `@n8n/node-cli` (lint, build, version bump, changelog, commit, tag, push). The tag push is what triggers `.github/workflows/publish.yml` to publish to npm with provenance. |

`.n8n-live/` is gitignored; delete it to reset local n8n state.

## Architecture

`index.ts` is intentionally empty (`export {}`). n8n loads classes directly from paths declared in `package.json#n8n.nodes` and `package.json#n8n.credentials`, not from `main`.

The node deliberately splits UI/orchestration from logic so the logic can be unit-tested without an n8n runtime:

- `nodes/DoneThat/DoneThat.node.ts`: `INodeType` description (UI properties, `displayOptions`), `loadOptions.getProjects`, and `execute()`. Contains no request shaping; delegates to the helpers below.
- `nodes/DoneThat/request.ts`: Pure functions that turn `(resource, operation, params)` into `IHttpRequestOptions`. Per-resource builders (`buildReportRequest`, `buildMessageRequest`, `buildProjectListRequest`, `buildProjectMutationRequest`, `buildSearchRequest`) plus a dispatcher (`buildDoneThatRequest`).
- `nodes/DoneThat/response.ts`: `normalizeDoneThatResponse` unwraps the DoneThat `{ success, ... }` envelope into n8n items. Throws on `success === false`. Resource-aware: report -> `body.rows`, search -> `body.results`, project list -> `body.projects`, project single -> `body.project`, message -> `{level, format, content, metadata}`.
- `nodes/DoneThat/projects.ts`: Builds the `GET /projects` request and maps the response into `{name, value}` options for the project dropdown.
- `nodes/DoneThat/dates.ts`: `dateToUtcStartMs` / `dateToUtcEndExclusiveMs` for the report `dateRange` body (DoneThat expects ms epoch, end-exclusive).
- `nodes/DoneThat/constants.ts`: `API_BASE_URL`, `API_DOCS_URL`, project color palette.
- `credentials/DoneThatApi.credentials.ts`: Generic auth via `x-api-key` header, base URL is user-configurable for testing, credential test hits `GET /user`.

All HTTP goes through `this.helpers.httpRequestWithAuthentication.call(this, 'doneThatApi', options)`. Never use `fetch`/`axios`/env vars/`fs`: n8n's verification guidelines forbid them, and the package has zero runtime `dependencies`.

## Hard contracts (enforced by `scripts/verify-n8n-package.mjs`)

The post-build verifier fails the build if any of these change. If you rename anything, update both the code and the verifier in the same commit:

- Credential exports a class **named** `DoneThatApi` (not default export).
- Credential instance `name === 'doneThatApi'`.
- Credential `test.request.url === '/user'`.
- Credential `documentationUrl === 'https://donethat.ai/api-reference'`.
- Node exports a class **named** `DoneThat` (not default export).
- Node `description.name === 'doneThat'`.
- Node has `methods.loadOptions.getProjects`.
- `dist/nodes/DoneThat/donethat.svg` exists after build (the icon is copied by `scripts/copy-assets.mjs`, not by `tsc`).

## Sample workflows

`scripts/sample-workflows.mjs` defines two workflows that are written into `.n8n-live/workflows/` when `npm run n8n:live` boots. They use `type: 'CUSTOM.doneThat'` because n8n:live loads the package via the custom-extension mechanism, not as an installed npm community node. The community-node type form (`n8n-nodes-donethat.doneThat`) is different; do not copy the sample-workflows JSON verbatim into user-facing docs.

## Publishing

Publishing to npm is done exclusively via `.github/workflows/publish.yml`, which fires on tag pushes matching `*.*.*` (bare, no `v` prefix). The workflow needs npm Trusted Publisher to be configured on npmjs.com against this repo and workflow filename. Local `npm publish` is blocked by `prepublishOnly: n8n-node prerelease`, which requires `RELEASE_MODE=true` (set only by `n8n-node release`).

Verify the published package against n8n's checks:

```bash
npx @n8n/scan-community-package n8n-nodes-donethat
```

## Style

No em-dashes (Unicode U+2014). Use a colon, comma, parenthetical, or plain hyphen instead.

# AGENTS.md

Guidance for AI coding agents working in this repo. Convention: https://agents.md/.

## What this is

n8n community node for DoneThat (https://donethat.ai), an automated AI time tracker. One node (`DoneThat`) with resources `report` (time-tracking reports), `message` (AI summary messages), `project` (project CRUD), `search` (across activity and tasks), plus a credential (`DoneThatApi`). Target: n8n's verified community nodes registry.

## Commands

Node 22.16+. `npm run n8n:live` and `test:live` auto-switch to Node 22 via nvm.

- `npm run build`: compiles to `dist/`, copies the SVG, runs `scripts/verify-n8n-package.mjs` (fails the build if the contracts below drift).
- `npm test`: runs `build` first, then Jest. Tests assert against `dist/`, so the build can't be skipped.
- `npx jest test/request.test.ts -t "report"`: single file or pattern.
- `npm run lint`: ESLint flat config in `eslint.config.mjs`, which imports `@n8n/node-cli/eslint` (the same config bundle `@n8n/scan-community-package` runs against the published tarball). Catches the n8n cloud rules (`@n8n/community-nodes/*`, `n8n-nodes-base/*`) before publish, including `valid-peer-dependencies` (which requires `peerDependencies.n8n-workflow === "*"`), `icon-validation`, `node-usable-as-tool`, alphabetical option ordering, etc. ESLint must be v9, not v10 (n8n's plugin uses ESLint 9 context API).
- `npm run n8n:live`: builds, installs n8n into `.n8n-live/` (first run 1-2 GB), packs and loads this node, opens http://127.0.0.1:5678.
- `npm run test:live`: headless CI variant.
- `npm run release`: interactive release-it (lint, build, bump, changelog, commit, tag, push). Tag push triggers `.github/workflows/publish.yml`.

## Architecture

`index.ts` is empty. n8n loads classes directly from the paths in `package.json#n8n`.

The node splits UI from logic so the logic is unit-testable without an n8n runtime:

- `DoneThat.node.ts`: `INodeType` description, `methods.listSearch.searchProjects` (powers the project Resource Locator's From-List mode), and `execute()`. Owns the multi-step upsert flow (lookup by name, then create or update).
- `request.ts`: pure builders that turn `(resource, operation, params)` into `IHttpRequestOptions`. Per-resource builders plus a dispatcher (`buildDoneThatRequest`).
- `response.ts`: `normalizeDoneThatResponse` unwraps the `{ success, ... }` envelope into n8n items (throws on `success === false`). `simplifyDoneThatItems` powers the user-facing `Simplify` toggle. Curated keys in `SIMPLIFY_KEYS` match `ReportRow` (snake_case, duration in minutes, one of `date`/`timestampIso`/`week` per row) and `SearchContentResultItem` (with `metadata.*` flattened to top-level).
- `projects.ts`: `GET /projects` request + RLC list-mode mapping with case-insensitive substring filter.
- `dates.ts`: `dateToUtcStartMs` / `dateToUtcEndExclusiveMs` for the report `dateRange` (DoneThat takes ms epoch, end-exclusive).
- `constants.ts`: API URLs, project color palette.
- `credentials/DoneThatApi.credentials.ts`: `x-api-key` header, configurable base URL, credential test against `GET /user`.

All HTTP goes through `this.helpers.httpRequestWithAuthentication.call(this, 'doneThatApi', options)`. No `fetch`/`axios`, no env vars, no `fs`, no runtime dependencies. n8n's verification rejects all of these.

## Contracts enforced by `scripts/verify-n8n-package.mjs`

The post-build verifier fails the build if any of these drift. Rename anything, update the verifier in the same commit:

- Credential class is named `DoneThatApi` (not default export).
- Credential `name === 'doneThatApi'`, `test.request.url === '/user'`, `documentationUrl === 'https://donethat.ai/api-reference'`.
- Node class is named `DoneThat` (not default export), `description.name === 'doneThat'`.
- Node has `methods.listSearch.searchProjects` (project Resource Locator's From List mode).
- `dist/nodes/DoneThat/donethat.svg` exists after build (copied by `scripts/copy-assets.mjs`, not `tsc`).

## Sample workflows

`scripts/sample-workflows.mjs` generates the workflows that `npm run n8n:live` imports. They use `type: 'CUSTOM.doneThat'` because n8n:live loads this package via the custom-extension mechanism. The installed community-node type is different. Don't copy these JSON files into user-facing docs.

## Publishing

Publishes only via `.github/workflows/publish.yml` on tag pushes matching `*.*.*`. Requires npm Trusted Publisher configured on npmjs.com (owner/repo/workflow filename must match). Local `npm publish` is blocked by `prepublishOnly: n8n-node prerelease`, which only lets through `npm publish` when `RELEASE_MODE=true` (set by `n8n-node release`).

After the publish step, the workflow runs `@n8n/scan-community-package` against the new version. This is the same check the Creator Portal runs at submission time, so a green workflow means submission won't fail on lint or provenance. If it fails post-publish, fix and ship a patch.

Manually:

```
npx @n8n/scan-community-package n8n-nodes-donethat
```

## Style

No em-dashes (U+2014). Use a colon, comma, parenthetical, or plain hyphen.

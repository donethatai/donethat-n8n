# Changelog

## 0.2.2 (2026-05-20)

### Fixed

- Project **Create** no longer reads the Archive-only `projectArchived` parameter (fixes “Could not get parameter”).
- Project **Archive** no longer reads Create/Update-only `projectName` and `projectFields` parameters (same error).

### Changed

- Local n8n dev (`npm run n8n:live`) installs n8n under `.n8n-live/` instead of `npx`, packs the node from `npm pack`, and re-imports sample workflows when the database is newer than the last import.
- `npm run n8n:live` and `npm run test:live` auto-use Node 22 from nvm when the shell is on an older Node.

## 0.2.1 (2026-05-20)

- DoneThat community node: Report, Summary Message, Project (list, get, create, update, archive), Search.
- DoneThat API credentials with `GET /user` connection test.
- Unit tests and CI (`lint`, `test`, `test:live`).
- Local dev helper `npm run n8n:live` with sample workflows.

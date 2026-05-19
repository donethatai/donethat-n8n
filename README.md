# n8n-nodes-donethat

Community n8n node for DoneThat.

## Current Scope

This first scaffold targets the DoneThat API-key HTTP surface:

- Generate reports
- Fetch rendered summary messages
- List, create, update, archive, and delete projects
- Search DoneThat task and screenshot history

## Credentials

Create a DoneThat API key in DoneThat settings and grant the scopes required by
the operations you want to use:

- `reports:read` for reports
- `messages:read` for rendered summary messages
- `projects:read` for listing or reading projects
- `projects:write` for creating, updating, archiving, or deleting projects
- `search:read` for search

The node sends the API key using the `x-api-key` header.

## Development

```bash
npm install
npm run build
```

For local n8n development, link this package into your n8n custom extensions
environment after building.

## Backend Prerequisite

The current Firebase backend exposes `/report`, `/message`, and legacy
`/project` through Hosting rewrites. Before publishing this node, expose stable
routes for the newer REST project API and search API, for example:

- `https://api.donethat.ai/projects/**`
- `https://api.donethat.ai/search`

The scaffold assumes those public routes exist.

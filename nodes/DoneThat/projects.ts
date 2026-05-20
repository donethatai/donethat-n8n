import type {IHttpRequestOptions, INodeListSearchItems} from 'n8n-workflow';

import {normalizeDoneThatResponse} from './response';

/**
 * Map a projects API response to Resource Locator list-search results.
 *
 * @param response - Raw API JSON
 * @param filter   - Optional case-insensitive substring filter (from the RLC search box)
 * @return name/value pairs for the resourceLocator list mode
 */
export function searchProjectsFromResponse(
  response: unknown,
  filter?: string,
): INodeListSearchItems[] {
  const rows = normalizeDoneThatResponse(response, 'project', 'getMany');
  const needle = filter?.trim().toLowerCase();
  return rows
    .filter((row) => typeof row.id === 'string' && typeof row.name === 'string')
    .filter((row) =>
      needle ? (row.name as string).toLowerCase().includes(needle) : true,
    )
    .map((row) => ({
      name: row.name as string,
      value: row.id as string,
    }));
}

/**
 * HTTP options to list projects (for dropdowns).
 *
 * @param baseUrl - API base URL
 * @return GET /projects request
 */
export function projectListHttpOptions(baseUrl: string): IHttpRequestOptions {
  return {
    method: 'GET',
    url: `${baseUrl}/projects`,
    qs: {
      includeArchived: 'true',
      sort: 'createdAt',
    },
    json: true,
  };
}

import type {IHttpRequestOptions} from 'n8n-workflow';

import {normalizeDoneThatResponse} from './response';

/**
 * Map a projects API response to n8n dropdown options.
 *
 * @param response - Raw API JSON
 * @return id/name pairs for options fields
 */
export function projectOptionsFromResponse(
  response: unknown,
): Array<{name: string; value: string}> {
  const rows = normalizeDoneThatResponse(response, 'project', 'list');
  return rows
    .filter((row) => typeof row.id === 'string' && typeof row.name === 'string')
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

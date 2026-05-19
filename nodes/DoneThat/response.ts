import type {IDataObject} from 'n8n-workflow';

/** DoneThat node resource keys. */
export type DoneThatResource = 'report' | 'message' | 'project' | 'search';

/**
 * Unwrap DoneThat `{ success, ... }` envelopes into one or more n8n items.
 *
 * @param response - Raw API JSON
 * @param resource - Resource being called
 * @param operation - Operation name
 * @return Item payloads
 */
export function normalizeDoneThatResponse(
  response: unknown,
  resource: DoneThatResource,
  operation: string,
): IDataObject[] {
  if (Array.isArray(response)) {
    return response.map((entry) => entry as IDataObject);
  }

  if (!response || typeof response !== 'object') {
    return [{value: response as IDataObject['value']}];
  }

  const body = response as IDataObject;
  if (body.success === false) {
    const message =
      typeof body.error === 'string' ? body.error : 'DoneThat API request failed';
    throw new Error(message);
  }

  if (resource === 'report' && Array.isArray(body.rows)) {
    return body.rows as IDataObject[];
  }

  if (resource === 'search' && Array.isArray(body.results)) {
    return body.results as IDataObject[];
  }

  if (resource === 'project' && operation === 'list' && Array.isArray(body.projects)) {
    return body.projects as IDataObject[];
  }

  if (resource === 'project' && body.project && typeof body.project === 'object') {
    return [body.project as IDataObject];
  }

  if (resource === 'message') {
    return [
      {
        level: body.level,
        format: body.format,
        content: body.content,
        metadata: body.metadata,
      },
    ];
  }

  return [body];
}

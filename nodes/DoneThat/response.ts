import type {IDataObject, INode, JsonObject} from 'n8n-workflow';
import {NodeApiError} from 'n8n-workflow';

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
  node: INode,
  itemIndex?: number,
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
    const status = getHttpStatus(body);
    const apiError = new NodeApiError(
      node,
      {message} as JsonObject,
      {
        itemIndex,
        ...(status ? {httpCode: status} : {}),
      },
    );
    apiError.context.doneThatResponse = body;
    throw apiError;
  }

  if (resource === 'report' && Array.isArray(body.rows)) {
    return body.rows as IDataObject[];
  }

  if (resource === 'search' && Array.isArray(body.results)) {
    return body.results as IDataObject[];
  }

  if (resource === 'project' && operation === 'getMany' && Array.isArray(body.projects)) {
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

function getHttpStatus(body: IDataObject): string | undefined {
  for (const key of ['httpCode', 'statusCode', 'status', 'status_code']) {
    const status = body[key];
    if (
      (typeof status === 'number' || typeof status === 'string') &&
      /^[1-5][0-9][0-9]$/.test(String(status))
    ) {
      return String(status);
    }
  }

  return undefined;
}

/**
 * One entry in a SIMPLIFY_KEYS list. A plain string picks `item[key]`; the
 * object form lets us flatten a dotted path under a renamed key (e.g.
 * `metadata.minutes` -> `minutes`).
 */
type SimplifyKey = string | {path: string; as: string};

/**
 * Curated field lists for the `Simplify` UX toggle, capped at ten fields per
 * the n8n UX guideline. Aligned with the live DoneThat API response shapes:
 *
 * - `report` rows: see `ReportRow` in donethat-firebase/functions/src/report.ts.
 *   Snake_case throughout. Each row carries exactly one of `date`,
 *   `timestampIso`, `week` depending on the aggregation level; the others are
 *   undefined and silently skipped.
 * - `search` results: see `SearchContentResultItem` in
 *   donethat-firebase/functions/src/types.ts. Source-specific fields live
 *   under nested `metadata`, which we flatten into top-level scalars.
 */
const SIMPLIFY_KEYS: Partial<Record<DoneThatResource, readonly SimplifyKey[]>> = {
  report: [
    'id',
    'date',
    'timestampIso',
    'week',
    'duration',
    'project',
    'category',
    'task',
    'headline',
    'description',
  ],
  search: [
    'id',
    'source',
    'timestamp',
    'title',
    'snippet',
    {path: 'metadata.minutes', as: 'minutes'},
    {path: 'metadata.projectId', as: 'projectId'},
    {path: 'metadata.taskId', as: 'taskId'},
    {path: 'metadata.categoryName', as: 'category'},
    {path: 'metadata.taskGroupId', as: 'taskGroupId'},
  ],
};

/** Resolve a dotted path against an object; returns undefined if any segment is missing. */
function getPath(source: IDataObject, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

/**
 * Reduce each item to at most ten curated, useful fields for the `Simplify`
 * toggle. Falls back to the first ten top-level scalar fields when no curated
 * list applies.
 */
export function simplifyDoneThatItems(
  items: IDataObject[],
  resource: DoneThatResource,
): IDataObject[] {
  const curated = SIMPLIFY_KEYS[resource];
  return items.map((item) => {
    if (curated) {
      const out: IDataObject = {};
      for (const entry of curated) {
        if (typeof entry === 'string') {
          if (item[entry] !== undefined) out[entry] = item[entry];
        } else {
          const value = getPath(item, entry.path);
          if (value !== undefined) out[entry.as] = value;
        }
      }
      return out;
    }
    const out: IDataObject = {};
    let count = 0;
    for (const [k, v] of Object.entries(item)) {
      if (count >= 10) break;
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
        out[k] = v;
        count += 1;
      }
    }
    return out;
  });
}

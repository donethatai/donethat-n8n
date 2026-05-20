import type {IDataObject, IHttpRequestOptions} from 'n8n-workflow';

import {dateToUtcEndExclusiveMs, dateToUtcStartMs} from './dates';
import type {DoneThatResource} from './response';

/** Split comma-separated IDs; undefined when empty. */
export function splitCsv(value: string): string[] | undefined {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

/** Trim trailing slashes from API base URL. */
export function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export interface ReportRequestParams {
  baseUrl: string;
  startDate: string;
  endDate: string;
  aggregationLevel: string;
  options: IDataObject;
}

/**
 * Build `POST /report` request options.
 *
 * @param params - Report parameters
 * @return HTTP request options
 */
export function buildReportRequest(params: ReportRequestParams): IHttpRequestOptions {
  const body: IDataObject = {
    dateRange: {
      from: dateToUtcStartMs(params.startDate),
      to: dateToUtcEndExclusiveMs(params.endDate),
    },
    aggregationLevel: params.aggregationLevel,
  };

  const options = params.options;
  for (const key of ['includeCategories', 'includeProjects', 'sort']) {
    if (options[key] !== undefined) body[key] = options[key];
  }
  if (typeof options.projectIds === 'string') body.projectIds = splitCsv(options.projectIds);
  if (typeof options.teamIds === 'string') body.teamIds = splitCsv(options.teamIds);

  return {
    method: 'POST',
    url: `${params.baseUrl}/report`,
    body,
    json: true,
  };
}

export interface MessageRequestParams {
  baseUrl: string;
  date: string;
  level: string;
  format: string;
}

/**
 * Build `GET /message` request options.
 *
 * @param params - Message parameters
 * @return HTTP request options
 */
export function buildMessageRequest(params: MessageRequestParams): IHttpRequestOptions {
  return {
    method: 'GET',
    url: `${params.baseUrl}/message`,
    qs: {
      date: params.date,
      level: params.level,
      format: params.format,
    },
    json: true,
  };
}

export interface ProjectListParams {
  baseUrl: string;
  includeArchived: boolean;
  sort: string;
}

/**
 * Build `GET /projects` list request options.
 *
 * @param params - List parameters
 * @return HTTP request options
 */
export function buildProjectListRequest(params: ProjectListParams): IHttpRequestOptions {
  return {
    method: 'GET',
    url: `${params.baseUrl}/projects`,
    qs: {
      includeArchived: params.includeArchived ? 'true' : 'false',
      sort: params.sort,
    },
    json: true,
  };
}

export interface ProjectMutationParams {
  baseUrl: string;
  operation: string;
  projectId?: string;
  name?: string;
  fields?: IDataObject;
  archived?: boolean;
}

/**
 * Build project create/update/archive request options.
 *
 * @param params - Project mutation parameters
 * @return HTTP request options
 */
export function buildProjectMutationRequest(params: ProjectMutationParams): IHttpRequestOptions {
  const body: IDataObject = {};

  if (params.operation === 'create' || params.operation === 'update') {
    if (params.name) body.name = params.name;
    const fields = params.fields ?? {};
    for (const key of ['description', 'color']) {
      if (typeof fields[key] === 'string' && fields[key] !== '') body[key] = fields[key];
    }
    for (const key of ['team', 'portfolio']) {
      if (typeof fields[key] === 'string') {
        body[key] = fields[key].trim() === '' ? null : fields[key];
      }
    }
    for (const key of ['private', 'confidential']) {
      if (typeof fields[key] === 'boolean') body[key] = fields[key];
    }
    if (params.operation === 'update' && typeof fields.archived === 'boolean') {
      body.archived = fields.archived;
    }
  }

  if (params.operation === 'archive') {
    body.archived = params.archived ?? true;
  }

  const url =
    params.operation === 'create'
      ? `${params.baseUrl}/projects`
      : `${params.baseUrl}/projects/${encodeURIComponent(String(params.projectId))}`;

  return {
    method: 'POST',
    url,
    body,
    json: true,
  };
}

export interface SearchRequestParams {
  baseUrl: string;
  query: string;
  options: IDataObject;
}

/**
 * Build `POST /search` request options.
 *
 * @param params - Search parameters
 * @return HTTP request options
 */
export function buildSearchRequest(params: SearchRequestParams): IHttpRequestOptions {
  const body: IDataObject = {query: params.query};
  const options = params.options;

  if (typeof options.context === 'string' && options.context) body.context = options.context;
  if (typeof options.days === 'number') body.days = options.days;
  if (typeof options.limit === 'number') body.limit = options.limit;
  if (Array.isArray(options.sources) && options.sources.length > 0) body.sources = options.sources;

  return {
    method: 'POST',
    url: `${params.baseUrl}/search`,
    body,
    json: true,
  };
}

export interface BuildRequestParams {
  baseUrl: string;
  resource: DoneThatResource;
  operation: string;
  getParameter: (name: string) => unknown;
  getCollection: (name: string) => IDataObject;
}

/**
 * Build HTTP request options for a DoneThat node item.
 *
 * @param params - Node parameters for one item
 * @return HTTP request options
 */
export function buildDoneThatRequest(params: BuildRequestParams): IHttpRequestOptions {
  const {baseUrl, resource, operation, getParameter, getCollection} = params;

  if (resource === 'report') {
    return buildReportRequest({
      baseUrl,
      startDate: String(getParameter('startDate')),
      endDate: String(getParameter('endDate')),
      aggregationLevel: String(getParameter('aggregationLevel')),
      options: getCollection('reportOptions'),
    });
  }

  if (resource === 'message') {
    return buildMessageRequest({
      baseUrl,
      date: String(getParameter('messageDate')),
      level: String(getParameter('messageLevel')),
      format: String(getParameter('messageFormat')),
    });
  }

  if (resource === 'project') {
    if (operation === 'list') {
      return buildProjectListRequest({
        baseUrl,
        includeArchived: Boolean(getParameter('includeArchived')),
        sort: String(getParameter('projectSort')),
      });
    }

    if (operation === 'get') {
      const projectId = String(getParameter('projectId'));
      return {
        method: 'GET',
        url: `${baseUrl}/projects/${encodeURIComponent(projectId)}`,
        json: true,
      };
    }

    if (operation === 'archive') {
      return buildProjectMutationRequest({
        baseUrl,
        operation,
        projectId: String(getParameter('projectId')),
        archived: getParameter('projectArchived') as boolean | undefined,
      });
    }

    return buildProjectMutationRequest({
      baseUrl,
      operation,
      projectId: operation === 'create' ? undefined : String(getParameter('projectId')),
      name: String(getParameter('projectName')),
      fields: getCollection('projectFields'),
    });
  }

  return buildSearchRequest({
    baseUrl,
    query: String(getParameter('query')),
    options: getCollection('searchOptions'),
  });
}

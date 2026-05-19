import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {PROJECT_COLOR_HELP} from './constants';
import {normalizeDoneThatResponse, type DoneThatResource} from './response';

interface DoneThatCredentials {
  baseUrl: string;
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function dateToUtcStartMs(value: string): number {
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return ms;
}

function dateToUtcEndExclusiveMs(value: string): number {
  return dateToUtcStartMs(value) + 24 * 60 * 60 * 1000;
}

function splitCsv(value: string): string[] | undefined {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export class DoneThat implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'DoneThat',
    name: 'doneThat',
    icon: 'file:donethat.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description: 'Work with DoneThat reports, summaries, projects, and search via api.donethat.ai',
    defaults: {
      name: 'DoneThat',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'doneThatApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Report', value: 'report' },
          { name: 'Summary Message', value: 'message' },
          { name: 'Project', value: 'project' },
          { name: 'Search', value: 'search' },
        ],
        default: 'report',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['report'] } },
        options: [{ name: 'Generate', value: 'generate', action: 'Generate a report' }],
        default: 'generate',
      },
      {
        displayName: 'Start Date',
        name: 'startDate',
        type: 'string',
        displayOptions: { show: { resource: ['report'], operation: ['generate'] } },
        default: '={{$today.minus({days: 7}).toISODate()}}',
        required: true,
        description: 'Inclusive start date in YYYY-MM-DD format',
      },
      {
        displayName: 'End Date',
        name: 'endDate',
        type: 'string',
        displayOptions: { show: { resource: ['report'], operation: ['generate'] } },
        default: '={{$today.toISODate()}}',
        required: true,
        description: 'Inclusive end date in YYYY-MM-DD format',
      },
      {
        displayName: 'Aggregation Level',
        name: 'aggregationLevel',
        type: 'options',
        displayOptions: { show: { resource: ['report'], operation: ['generate'] } },
        options: [
          { name: 'Activity', value: 'activity' },
          { name: 'Day', value: 'day' },
          { name: 'Minute (legacy alias)', value: 'minute' },
          { name: 'Task', value: 'task' },
          { name: 'Week', value: 'week' },
        ],
        default: 'day',
        description: 'Activity is per-screenshot tracking. minute is a legacy alias for activity.',
      },
      {
        displayName: 'Additional Fields',
        name: 'reportOptions',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['report'], operation: ['generate'] } },
        default: {},
        options: [
          {
            displayName: 'Include Categories',
            name: 'includeCategories',
            type: 'boolean',
            default: true,
          },
          {
            displayName: 'Include Projects',
            name: 'includeProjects',
            type: 'boolean',
            default: true,
          },
          {
            displayName: 'Project IDs',
            name: 'projectIds',
            type: 'string',
            default: '',
            description: 'Comma-separated project IDs',
          },
          {
            displayName: 'Sort',
            name: 'sort',
            type: 'options',
            options: [
              { name: 'Newest First', value: 'desc' },
              { name: 'Oldest First', value: 'asc' },
            ],
            default: 'desc',
          },
          {
            displayName: 'Team IDs',
            name: 'teamIds',
            type: 'string',
            default: '',
            description: 'Comma-separated team IDs',
          },
        ],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['message'] } },
        options: [{ name: 'Get', value: 'get', action: 'Get a rendered summary message' }],
        default: 'get',
      },
      {
        displayName: 'Date',
        name: 'messageDate',
        type: 'string',
        displayOptions: { show: { resource: ['message'], operation: ['get'] } },
        default: '={{$today.minus({days: 1}).toISODate()}}',
        required: true,
        description: 'Date in YYYY-MM-DD format (API default is yesterday in your timezone)',
      },
      {
        displayName: 'Level',
        name: 'messageLevel',
        type: 'options',
        displayOptions: { show: { resource: ['message'], operation: ['get'] } },
        options: [
          { name: 'Day', value: 'day' },
          { name: 'Week', value: 'week' },
          { name: 'Month', value: 'month' },
          { name: 'Quarter', value: 'quarter' },
          { name: 'Year', value: 'year' },
        ],
        default: 'day',
      },
      {
        displayName: 'Format',
        name: 'messageFormat',
        type: 'options',
        displayOptions: { show: { resource: ['message'], operation: ['get'] } },
        options: [
          { name: 'HTML', value: 'html' },
          { name: 'Slack Blocks', value: 'slack' },
          { name: 'Text', value: 'text' },
        ],
        default: 'text',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['project'] } },
        options: [
          { name: 'Archive', value: 'archive', action: 'Archive or unarchive a project' },
          { name: 'Create', value: 'create', action: 'Create a project' },
          { name: 'Get', value: 'get', action: 'Get a project' },
          { name: 'List', value: 'list', action: 'List projects' },
          { name: 'Update', value: 'update', action: 'Update a project' },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        displayOptions: {
          show: { resource: ['project'], operation: ['get', 'update', 'archive'] },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Name',
        name: 'projectName',
        type: 'string',
        displayOptions: { show: { resource: ['project'], operation: ['create', 'update'] } },
        default: '',
      },
      {
        displayName: 'Additional Fields',
        name: 'projectFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['project'], operation: ['create'] } },
        default: {},
        options: [
          {
            displayName: 'Color',
            name: 'color',
            type: 'string',
            default: '',
            description: PROJECT_COLOR_HELP,
          },
          { displayName: 'Confidential', name: 'confidential', type: 'boolean', default: false },
          { displayName: 'Description', name: 'description', type: 'string', default: '' },
          { displayName: 'Portfolio', name: 'portfolio', type: 'string', default: '' },
          { displayName: 'Private', name: 'private', type: 'boolean', default: false },
          { displayName: 'Team', name: 'team', type: 'string', default: '' },
        ],
      },
      {
        displayName: 'Additional Fields',
        name: 'projectFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['project'], operation: ['update'] } },
        default: {},
        options: [
          {
            displayName: 'Color',
            name: 'color',
            type: 'string',
            default: '',
            description: PROJECT_COLOR_HELP,
          },
          { displayName: 'Description', name: 'description', type: 'string', default: '' },
          { displayName: 'Portfolio', name: 'portfolio', type: 'string', default: '' },
          { displayName: 'Private', name: 'private', type: 'boolean', default: false },
          { displayName: 'Team', name: 'team', type: 'string', default: '' },
        ],
      },
      {
        displayName: 'Archived',
        name: 'projectArchived',
        type: 'boolean',
        displayOptions: { show: { resource: ['project'], operation: ['archive'] } },
        default: true,
      },
      {
        displayName: 'Include Archived',
        name: 'includeArchived',
        type: 'boolean',
        displayOptions: { show: { resource: ['project'], operation: ['list'] } },
        default: false,
      },
      {
        displayName: 'Sort By',
        name: 'projectSort',
        type: 'options',
        displayOptions: { show: { resource: ['project'], operation: ['list'] } },
        options: [
          { name: 'Created At', value: 'createdAt' },
          { name: 'Updated At', value: 'updatedAt' },
          { name: 'Used At', value: 'usedAt' },
        ],
        default: 'createdAt',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['search'] } },
        options: [{ name: 'Search', value: 'search', action: 'Search DoneThat content' }],
        default: 'search',
      },
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        displayOptions: { show: { resource: ['search'], operation: ['search'] } },
        default: '',
        required: true,
      },
      {
        displayName: 'Additional Fields',
        name: 'searchOptions',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['search'], operation: ['search'] } },
        default: {},
        options: [
          { displayName: 'Context', name: 'context', type: 'string', default: '' },
          { displayName: 'Days', name: 'days', type: 'number', default: 7 },
          { displayName: 'Limit', name: 'limit', type: 'number', default: 20 },
          {
            displayName: 'Sources',
            name: 'sources',
            type: 'multiOptions',
            options: [
              { name: 'Activity', value: 'activity' },
              { name: 'Screenshots (legacy alias)', value: 'screenshots' },
              { name: 'Tasks', value: 'tasks' },
            ],
            default: ['tasks', 'activity'],
            description: 'screenshots is accepted by the API as an alias for activity.',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = (await this.getCredentials('doneThatApi')) as unknown as DoneThatCredentials;
    const baseUrl = trimBaseUrl(credentials.baseUrl);

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const resource = this.getNodeParameter('resource', itemIndex) as DoneThatResource;
      const operation = this.getNodeParameter('operation', itemIndex);

      try {
        const response: unknown = await this.helpers.httpRequestWithAuthentication.call(
          this,
          'doneThatApi',
          buildRequest(this, baseUrl, resource, operation, itemIndex),
        );

        const itemsOut = normalizeDoneThatResponse(response, resource, operation);
        for (const entry of itemsOut) {
          returnData.push({
            json: entry,
            pairedItem: { item: itemIndex },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : String(error),
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }

    return [returnData];
  }
}

function buildRequest(
  executeFunctions: IExecuteFunctions,
  baseUrl: string,
  resource: DoneThatResource,
  operation: string,
  itemIndex: number,
): IHttpRequestOptions {
  if (resource === 'report') {
    const startDate = executeFunctions.getNodeParameter('startDate', itemIndex) as string;
    const endDate = executeFunctions.getNodeParameter('endDate', itemIndex) as string;
    const options = executeFunctions.getNodeParameter('reportOptions', itemIndex, {}) as IDataObject;
    const body: IDataObject = {
      dateRange: {
        from: dateToUtcStartMs(startDate),
        to: dateToUtcEndExclusiveMs(endDate),
      },
      aggregationLevel: executeFunctions.getNodeParameter('aggregationLevel', itemIndex),
    };

    for (const key of ['includeCategories', 'includeProjects', 'sort']) {
      if (options[key] !== undefined) body[key] = options[key];
    }
    if (typeof options.projectIds === 'string') body.projectIds = splitCsv(options.projectIds);
    if (typeof options.teamIds === 'string') body.teamIds = splitCsv(options.teamIds);

    return {
      method: 'POST',
      url: `${baseUrl}/report`,
      body,
      json: true,
    };
  }

  if (resource === 'message') {
    return {
      method: 'GET',
      url: `${baseUrl}/message`,
      qs: {
        date: executeFunctions.getNodeParameter('messageDate', itemIndex),
        level: executeFunctions.getNodeParameter('messageLevel', itemIndex),
        format: executeFunctions.getNodeParameter('messageFormat', itemIndex),
      },
      json: true,
    };
  }

  if (resource === 'project') {
    return buildProjectRequest(executeFunctions, baseUrl, operation, itemIndex);
  }

  return buildSearchRequest(executeFunctions, baseUrl, itemIndex);
}

function buildProjectRequest(
  executeFunctions: IExecuteFunctions,
  baseUrl: string,
  operation: string,
  itemIndex: number,
): IHttpRequestOptions {
  if (operation === 'list') {
    return {
      method: 'GET',
      url: `${baseUrl}/projects`,
      qs: {
        includeArchived: executeFunctions.getNodeParameter('includeArchived', itemIndex),
        sort: executeFunctions.getNodeParameter('projectSort', itemIndex),
      },
      json: true,
    };
  }

  if (operation === 'get') {
    const projectId = executeFunctions.getNodeParameter('projectId', itemIndex) as string;
    return { method: 'GET', url: `${baseUrl}/projects/${projectId}`, json: true };
  }

  const body: IDataObject = {};
  if (operation === 'create' || operation === 'update') {
    const name = executeFunctions.getNodeParameter('projectName', itemIndex, '') as string;
    const fields = executeFunctions.getNodeParameter('projectFields', itemIndex, {}) as IDataObject;
    if (name) body.name = name;
    for (const key of ['description', 'color', 'team', 'portfolio']) {
      if (typeof fields[key] === 'string' && fields[key] !== '') body[key] = fields[key];
    }
    for (const key of ['private', 'confidential']) {
      if (typeof fields[key] === 'boolean') body[key] = fields[key];
    }
  }

  if (operation === 'archive') {
    body.archived = executeFunctions.getNodeParameter('projectArchived', itemIndex);
  }

  const projectId =
    operation === 'create'
      ? undefined
      : (executeFunctions.getNodeParameter('projectId', itemIndex) as string);

  return {
    method: 'POST',
    url: operation === 'create' ? `${baseUrl}/projects` : `${baseUrl}/projects/${projectId}`,
    body,
    json: true,
  };
}

function buildSearchRequest(
  executeFunctions: IExecuteFunctions,
  baseUrl: string,
  itemIndex: number,
): IHttpRequestOptions {
  const options = executeFunctions.getNodeParameter('searchOptions', itemIndex, {}) as IDataObject;
  const body: IDataObject = {
    query: executeFunctions.getNodeParameter('query', itemIndex),
  };

  if (typeof options.context === 'string' && options.context) body.context = options.context;
  if (typeof options.days === 'number') body.days = options.days;
  if (typeof options.limit === 'number') body.limit = options.limit;
  if (Array.isArray(options.sources) && options.sources.length > 0) body.sources = options.sources;

  return {
    method: 'POST',
    url: `${baseUrl}/search`,
    body,
    json: true,
  };
}

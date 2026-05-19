import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import {NodeConnectionTypes, NodeOperationError} from 'n8n-workflow';

import {PROJECT_COLOR_HELP, PROJECT_COLORS} from './constants';
import {projectListHttpOptions, projectOptionsFromResponse} from './projects';
import {buildDoneThatRequest, trimBaseUrl} from './request';
import {normalizeDoneThatResponse, type DoneThatResource} from './response';

const PROJECT_COLOR_OPTIONS = PROJECT_COLORS.map((value) => ({name: value, value}));

interface DoneThatCredentials {
  baseUrl: string;
}

export class DoneThat implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'DoneThat',
    name: 'doneThat',
    icon: 'file:donethat.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description: 'Reports, summaries, projects, and search via the DoneThat API.',
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
        displayName: 'Project',
        name: 'projectId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getProjects',
        },
        displayOptions: {
          show: {resource: ['project'], operation: ['get', 'update', 'archive']},
        },
        default: '',
        required: true,
        description: 'Loaded from GET /projects (includes archived).',
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
            type: 'options',
            options: PROJECT_COLOR_OPTIONS,
            default: '',
            description: PROJECT_COLOR_HELP,
          },
          {displayName: 'Confidential', name: 'confidential', type: 'boolean', default: false},
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
            type: 'options',
            options: PROJECT_COLOR_OPTIONS,
            default: '',
            description: PROJECT_COLOR_HELP,
          },
          {displayName: 'Description', name: 'description', type: 'string', default: ''},
          {displayName: 'Portfolio', name: 'portfolio', type: 'string', default: ''},
          {displayName: 'Private', name: 'private', type: 'boolean', default: false},
          {displayName: 'Team', name: 'team', type: 'string', default: ''},
          {
            displayName: 'Archived',
            name: 'archived',
            type: 'boolean',
            default: false,
            description: 'Set false to unarchive when updating.',
          },
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

  methods = {
    loadOptions: {
      async getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('doneThatApi');
        const baseUrl = trimBaseUrl(credentials.baseUrl as string);
        const response: unknown = await this.helpers.httpRequestWithAuthentication.call(
          this,
          'doneThatApi',
          projectListHttpOptions(baseUrl),
        );
        return projectOptionsFromResponse(response);
      },
    },
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
          buildDoneThatRequest({
            baseUrl,
            resource,
            operation,
            getParameter: (name) => this.getNodeParameter(name, itemIndex),
            getCollection: (name) =>
              this.getNodeParameter(name, itemIndex, {}) as IDataObject,
          }),
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

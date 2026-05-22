import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodeListSearchResult,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import {NodeConnectionTypes, NodeOperationError} from 'n8n-workflow';

import {PROJECT_COLOR_HELP, PROJECT_COLORS} from './constants';
import {projectListHttpOptions, searchProjectsFromResponse} from './projects';
import {buildDoneThatRequest, buildProjectMutationRequest, trimBaseUrl} from './request';
import {
  normalizeDoneThatResponse,
  simplifyDoneThatItems,
  type DoneThatResource,
} from './response';

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
    usableAsTool: true,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description:
      'DoneThat automatically tracks all work to boost productivity. This node exposes time-tracking reports, AI summary messages, projects, and search across your activity.',
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
          { name: 'Project', value: 'project' },
          { name: 'Report', value: 'report' },
          { name: 'Search', value: 'search' },
          { name: 'Summary Message', value: 'message' },
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
          { name: 'Minute (Legacy Alias)', value: 'minute' },
          { name: 'Task', value: 'task' },
          { name: 'Week', value: 'week' },
        ],
        default: 'day',
        description: 'Activity is per-screenshot tracking. minute is a legacy alias for activity.',
      },
      {
        displayName: 'Simplify',
        name: 'simplify',
        type: 'boolean',
        displayOptions: { show: { resource: ['report'], operation: ['generate'] } },
        default: false,
        description:
          'Whether to return a simplified version of the response instead of the raw data',
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
            placeholder: 'e.g. proj_01HABC, proj_01HDEF',
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
            placeholder: 'e.g. team_01HABC, team_01HDEF',
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
          { name: 'Month', value: 'month' },
          { name: 'Quarter', value: 'quarter' },
          { name: 'Week', value: 'week' },
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
          { name: 'Create or Update', value: 'upsert', action: 'Create or update a project' },
          { name: 'Get', value: 'get', action: 'Get a project' },
          { name: 'Get Many', value: 'getMany', action: 'Get many projects' },
          { name: 'Update', value: 'update', action: 'Update a project' },
        ],
        default: 'getMany',
      },
      {
        displayName: 'Project',
        name: 'projectId',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        displayOptions: {
          show: {resource: ['project'], operation: ['get', 'update', 'archive']},
        },
        description: 'Pick from the list or paste an existing project ID',
        modes: [
          {
            displayName: 'From List',
            name: 'list',
            type: 'list',
            placeholder: 'Select a project...',
            typeOptions: {
              searchListMethod: 'searchProjects',
              searchable: true,
            },
          },
          {
            displayName: 'By ID',
            name: 'id',
            type: 'string',
            placeholder: 'e.g. proj_01HABC...',
            validation: [
              {
                type: 'regex',
                properties: {regex: '.+', errorMessage: 'Project ID is required'},
              },
            ],
          },
        ],
      },
      {
        displayName: 'Name',
        name: 'projectName',
        type: 'string',
        displayOptions: { show: { resource: ['project'], operation: ['create', 'update', 'upsert'] } },
        default: '',
        placeholder: 'e.g. Q3 Roadmap',
        description: 'For Create or Update (upsert), this is also the lookup key',
      },
      {
        displayName: 'Additional Fields',
        name: 'projectFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['project'], operation: ['create', 'upsert'] } },
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
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: '',
            placeholder: 'e.g. Internal infra rollout',
          },
          {
            displayName: 'Portfolio',
            name: 'portfolio',
            type: 'string',
            default: '',
            placeholder: 'e.g. Platform',
          },
          { displayName: 'Private', name: 'private', type: 'boolean', default: false },
          {
            displayName: 'Team',
            name: 'team',
            type: 'string',
            default: '',
            placeholder: 'e.g. Backend',
          },
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
            displayName: 'Archived',
            name: 'archived',
            type: 'boolean',
            default: false,
            description: 'Whether to archive the project on update. Set false to unarchive.',
          },
          {
            displayName: 'Color',
            name: 'color',
            type: 'options',
            options: PROJECT_COLOR_OPTIONS,
            default: '',
            description: PROJECT_COLOR_HELP,
          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: '',
            placeholder: 'e.g. Internal infra rollout',
          },
          {
            displayName: 'Portfolio',
            name: 'portfolio',
            type: 'string',
            default: '',
            placeholder: 'e.g. Platform',
          },
          {displayName: 'Private', name: 'private', type: 'boolean', default: false},
          {
            displayName: 'Team',
            name: 'team',
            type: 'string',
            default: '',
            placeholder: 'e.g. Backend',
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
        displayOptions: { show: { resource: ['project'], operation: ['getMany'] } },
        default: false,
      },
      {
        displayName: 'Sort By',
        name: 'projectSort',
        type: 'options',
        displayOptions: { show: { resource: ['project'], operation: ['getMany'] } },
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
        options: [{ name: 'Search', value: 'search', action: 'Search done that content' }],
        default: 'search',
      },
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        displayOptions: { show: { resource: ['search'], operation: ['search'] } },
        default: '',
        placeholder: 'e.g. quarterly planning',
        required: true,
      },
      {
        displayName: 'Simplify',
        name: 'simplify',
        type: 'boolean',
        displayOptions: { show: { resource: ['search'], operation: ['search'] } },
        default: false,
        description:
          'Whether to return a simplified version of the response instead of the raw data',
      },
      {
        displayName: 'Additional Fields',
        name: 'searchOptions',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['search'], operation: ['search'] } },
        default: {},
        options: [
          {
            displayName: 'Context',
            name: 'context',
            type: 'string',
            default: '',
            placeholder: 'e.g. retrospective notes',
          },
          { displayName: 'Days', name: 'days', type: 'number', default: 7 },
          { displayName: 'Limit', name: 'limit', type: 'number',
																																																	typeOptions: {
																																																		minValue: 1,
																																																	},
																																																	description: 'Max number of results to return', default: 50 },
          {
            displayName: 'Sources',
            name: 'sources',
            type: 'multiOptions',
            options: [
              { name: 'Activity', value: 'activity' },
              { name: 'Tasks', value: 'tasks' },
            ],
            default: ['tasks', 'activity'],
            description: 'Sources to search',
          },
        ],
      },
    ],
  };

  methods = {
    listSearch: {
      async searchProjects(
        this: ILoadOptionsFunctions,
        filter?: string,
      ): Promise<INodeListSearchResult> {
        const credentials = await this.getCredentials('doneThatApi');
        const baseUrl = trimBaseUrl(credentials.baseUrl as string);
        const response: unknown = await this.helpers.httpRequestWithAuthentication.call(
          this,
          'doneThatApi',
          projectListHttpOptions(baseUrl),
        );
        return {results: searchProjectsFromResponse(response, filter)};
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = (await this.getCredentials('doneThatApi')) as unknown as DoneThatCredentials;
    const baseUrl = trimBaseUrl(credentials.baseUrl);

    /**
     * Read a Resource Locator value as a bare string id, regardless of mode.
     */
    const readProjectId = (itemIndex: number): string => {
      const raw = this.getNodeParameter('projectId', itemIndex, '') as
        | string
        | {value?: string; mode?: string};
      if (typeof raw === 'string') return raw;
      return String(raw?.value ?? '');
    };

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const resource = this.getNodeParameter('resource', itemIndex) as DoneThatResource;
      const operation = this.getNodeParameter('operation', itemIndex);

      try {
        let response: unknown;

        if (resource === 'project' && operation === 'upsert') {
          // Upsert: look up by exact name, then update or create.
          // NOTE: name match is not unique in DoneThat. If multiple projects share the name,
          // we update the first match returned by GET /projects.
          const projectName = this.getNodeParameter('projectName', itemIndex) as string;
          const fields = this.getNodeParameter(
            'projectFields',
            itemIndex,
            {},
          ) as IDataObject;
          const lookup: unknown = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'doneThatApi',
            projectListHttpOptions(baseUrl),
          );
          const projects = ((lookup as IDataObject).projects ?? []) as IDataObject[];
          const existing = projects.find((p) => p.name === projectName);
          const existingId = existing && typeof existing.id === 'string' ? existing.id : undefined;
          let mutation;
          if (existingId) {
            // POST /projects/:id rejects `confidential` (400) because it would change
            // visibility of existing tasks. Strip it on the update branch of upsert so
            // the operation does not fail when the user sets Confidential on a project
            // that already exists.
            const updateFields = {...fields};
            delete updateFields.confidential;
            mutation = buildProjectMutationRequest({
              baseUrl,
              operation: 'update',
              projectId: existingId,
              name: projectName,
              fields: updateFields,
            });
          } else {
            mutation = buildProjectMutationRequest({
              baseUrl,
              operation: 'create',
              name: projectName,
              fields,
            });
          }
          response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'doneThatApi',
            mutation,
          );
        } else {
          response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'doneThatApi',
            buildDoneThatRequest({
              baseUrl,
              resource,
              operation,
              getParameter: (name) => {
                if (name === 'projectId') return readProjectId(itemIndex);
                return this.getNodeParameter(name, itemIndex);
              },
              getCollection: (name) =>
                this.getNodeParameter(name, itemIndex, {}) as IDataObject,
            }),
          );
        }

        let itemsOut = normalizeDoneThatResponse(response, resource, operation);

        const simplifyApplies =
          (resource === 'report' && operation === 'generate') ||
          (resource === 'search' && operation === 'search');
        if (simplifyApplies) {
          const simplify = this.getNodeParameter('simplify', itemIndex, false) as boolean;
          if (simplify) {
            itemsOut = simplifyDoneThatItems(itemsOut, resource);
          }
        }

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

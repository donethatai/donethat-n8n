function doneThatNode({ id, name, position, resource, operation, parameters, continueOnFail = true }) {
  return {
    parameters: { resource, operation, ...parameters },
    id,
    name,
    type: 'CUSTOM.doneThat',
    typeVersion: 1,
    position,
    continueOnFail,
  };
}

function manualTrigger(id, position = [0, 300]) {
  return {
    parameters: {},
    id,
    name: 'Run manually',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position,
  };
}

function stickyNote(id, content, position = [0, 0], width = 520, height = 220) {
  return {
    parameters: { content, height, width, color: 4 },
    id,
    name: 'Notes',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position,
  };
}

function workflowBase({ id, name, nodes, connections }) {
  return {
    id,
    name,
    active: false,
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    staticData: null,
    pinData: {},
    versionId: `${id}-v1`,
    meta: { templateCredsSetupCompleted: false },
    tags: [],
  };
}

export const sampleWorkflows = [
  {
    file: '01-donethat-read-only.json',
    workflow: workflowBase({
      id: 'donethat-samples-read-only',
      name: 'DoneThat Samples - Read-only Endpoints',
      nodes: [
        stickyNote(
          'note-read-only',
          [
            'Create a DoneThat API credential, then select it on each DoneThat node before executing.',
            '',
            'Read-style API calls: POST /report, GET /message, GET /projects, POST /search',
            'Continue On Fail is enabled on all DoneThat nodes.',
          ].join('\n'),
        ),
        manualTrigger('manual-read-only', [0, 360]),
        doneThatNode({
          id: 'report-week',
          name: 'Report - Last 7 Days by Day',
          position: [320, 120],
          resource: 'report',
          operation: 'generate',
          parameters: {
            startDate: '={{$today.minus({days: 7}).toISODate()}}',
            endDate: '={{$today.toISODate()}}',
            aggregationLevel: 'day',
            reportOptions: { includeCategories: true, includeProjects: true, sort: 'desc' },
          },
        }),
        doneThatNode({
          id: 'message-yesterday',
          name: 'Summary Message - Yesterday',
          position: [320, 300],
          resource: 'message',
          operation: 'get',
          parameters: {
            messageDate: '={{$today.minus({days: 1}).toISODate()}}',
            messageLevel: 'day',
            messageFormat: 'text',
          },
        }),
        doneThatNode({
          id: 'project-list',
          name: 'Projects - List Active',
          position: [320, 480],
          resource: 'project',
          operation: 'getMany',
          parameters: { includeArchived: false, projectSort: 'updatedAt' },
        }),
        doneThatNode({
          id: 'search-recent',
          name: 'Search - Recent Planning Mentions',
          position: [320, 660],
          resource: 'search',
          operation: 'search',
          parameters: {
            query: 'planning',
            searchOptions: { days: 14, limit: 10, sources: ['tasks', 'activity'] },
          },
        }),
      ],
      connections: {
        'Run manually': {
          main: [
            [
              { node: 'Report - Last 7 Days by Day', type: 'main', index: 0 },
              { node: 'Summary Message - Yesterday', type: 'main', index: 0 },
              { node: 'Projects - List Active', type: 'main', index: 0 },
              { node: 'Search - Recent Planning Mentions', type: 'main', index: 0 },
            ],
          ],
        },
      },
    }),
  },
  {
    file: '02-donethat-project-lifecycle.json',
    workflow: workflowBase({
      id: 'donethat-samples-project-lifecycle',
      name: 'DoneThat Samples - Project Lifecycle (Creates Then Archives)',
      nodes: [
        stickyNote(
          'note-project-lifecycle',
          'Creates a sample project, updates it, then archives it. Run only if you are OK with one archived test project.',
          [0, 0],
          560,
          160,
        ),
        manualTrigger('manual-project-lifecycle', [0, 360]),
        doneThatNode({
          id: 'project-create',
          name: 'Project - Create Sample',
          position: [300, 360],
          resource: 'project',
          operation: 'create',
          parameters: {
            projectName: 'n8n Sample Project {{$now.toFormat("yyyy-LL-dd HH:mm")}}',
            projectFields: {
              description: 'Created by the DoneThat n8n sample workflow, then archived.',
              private: true,
              confidential: false,
            },
          },
          continueOnFail: false,
        }),
        doneThatNode({
          id: 'project-get',
          name: 'Project - Get Created',
          position: [600, 360],
          resource: 'project',
          operation: 'get',
          parameters: { projectId: { __rl: true, value: '={{$json.id}}', mode: 'id' } },
          continueOnFail: false,
        }),
        doneThatNode({
          id: 'project-update',
          name: 'Project - Update Description',
          position: [900, 360],
          resource: 'project',
          operation: 'update',
          parameters: {
            projectId: { __rl: true, value: '={{$json.id}}', mode: 'id' },
            projectName: '={{$json.name}}',
            projectFields: {
              description: 'Updated by the DoneThat n8n sample workflow before archiving.',
            },
          },
          continueOnFail: false,
        }),
        doneThatNode({
          id: 'project-archive',
          name: 'Project - Archive Sample',
          position: [1200, 360],
          resource: 'project',
          operation: 'archive',
          parameters: {
            projectId: { __rl: true, value: '={{$json.id}}', mode: 'id' },
            projectArchived: true,
          },
          continueOnFail: false,
        }),
      ],
      connections: {
        'Run manually': { main: [[{ node: 'Project - Create Sample', type: 'main', index: 0 }]] },
        'Project - Create Sample': { main: [[{ node: 'Project - Get Created', type: 'main', index: 0 }]] },
        'Project - Get Created': {
          main: [[{ node: 'Project - Update Description', type: 'main', index: 0 }]],
        },
        'Project - Update Description': {
          main: [[{ node: 'Project - Archive Sample', type: 'main', index: 0 }]],
        },
      },
    }),
  },
];

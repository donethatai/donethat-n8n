import {
  buildDoneThatRequest,
  buildMessageRequest,
  buildProjectListRequest,
  buildProjectMutationRequest,
  buildReportRequest,
  buildSearchRequest,
  splitCsv,
  trimBaseUrl,
} from '../nodes/DoneThat/request';

describe('request builders', () => {
  it('trims base URL slashes', () => {
    expect(trimBaseUrl('https://api.donethat.ai/')).toBe('https://api.donethat.ai');
  });

  it('splits CSV project ids', () => {
    expect(splitCsv(' a, b ,')).toEqual(['a', 'b']);
    expect(splitCsv('  ')).toBeUndefined();
  });

  it('builds report body with date range', () => {
    const req = buildReportRequest({
      baseUrl: 'https://api.donethat.ai',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      aggregationLevel: 'activity',
      options: {sort: 'desc', projectIds: 'p1, p2'},
    });
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.donethat.ai/report');
    expect(req.body).toMatchObject({
      aggregationLevel: 'activity',
      projectIds: ['p1', 'p2'],
    });
  });

  it('builds search body with sources', () => {
    const req = buildSearchRequest({
      baseUrl: 'https://api.donethat.ai',
      query: 'deploy',
      options: {days: 7, sources: ['tasks', 'activity']},
    });
    expect(req.body).toEqual({
      query: 'deploy',
      days: 7,
      sources: ['tasks', 'activity'],
    });
  });

  it('builds message query string', () => {
    const req = buildMessageRequest({
      baseUrl: 'https://api.donethat.ai',
      date: '2026-05-18',
      level: 'day',
      format: 'text',
    });
    expect(req.qs).toEqual({date: '2026-05-18', level: 'day', format: 'text'});
  });

  it('serializes includeArchived as string for the API', () => {
    const req = buildProjectListRequest({
      baseUrl: 'https://api.donethat.ai',
      includeArchived: true,
      sort: 'createdAt',
    });
    expect(req.qs).toEqual({includeArchived: 'true', sort: 'createdAt'});
  });

  it('clears team and portfolio with null on update', () => {
    const req = buildProjectMutationRequest({
      baseUrl: 'https://api.donethat.ai',
      operation: 'update',
      projectId: 'p1',
      fields: {team: '', portfolio: '  '},
    });
    expect(req.body).toEqual({team: null, portfolio: null});
  });

  it('builds project archive body', () => {
    const req = buildProjectMutationRequest({
      baseUrl: 'https://api.donethat.ai',
      operation: 'archive',
      projectId: 'p1',
      archived: false,
    });
    expect(req.url).toBe('https://api.donethat.ai/projects/p1');
    expect(req.body).toEqual({archived: false});
  });

  it('builds project update with archived flag in fields', () => {
    const req = buildProjectMutationRequest({
      baseUrl: 'https://api.donethat.ai',
      operation: 'update',
      projectId: 'p1',
      name: 'Renamed',
      fields: {archived: true, color: '#FFB623'},
    });
    expect(req.body).toMatchObject({name: 'Renamed', archived: true, color: '#FFB623'});
  });

  it('routes buildDoneThatRequest for project create without archive params', () => {
    const requested: string[] = [];
    const req = buildDoneThatRequest({
      baseUrl: 'https://api.donethat.ai',
      resource: 'project',
      operation: 'create',
      getParameter: (name) => {
        requested.push(name);
        if (name === 'projectName') return 'Sample';
        throw new Error(`unexpected parameter: ${name}`);
      },
      getCollection: (name) => {
        requested.push(name);
        return {private: true, description: 'test'};
      },
    });
    expect(requested).not.toContain('projectArchived');
    expect(requested).not.toContain('projectId');
    expect(req).toMatchObject({
      method: 'POST',
      url: 'https://api.donethat.ai/projects',
      body: {name: 'Sample', private: true, description: 'test'},
    });
  });

  it('routes buildDoneThatRequest for project archive without create/update params', () => {
    const requested: string[] = [];
    const req = buildDoneThatRequest({
      baseUrl: 'https://api.donethat.ai',
      resource: 'project',
      operation: 'archive',
      getParameter: (name) => {
        requested.push(name);
        if (name === 'projectId') return 'p1';
        if (name === 'projectArchived') return true;
        throw new Error(`unexpected parameter: ${name}`);
      },
      getCollection: () => {
        throw new Error('unexpected collection');
      },
    });
    expect(requested).toEqual(['projectId', 'projectArchived']);
    expect(req).toMatchObject({
      method: 'POST',
      url: 'https://api.donethat.ai/projects/p1',
      body: {archived: true},
    });
  });

  it('routes buildDoneThatRequest for project get', () => {
    const req = buildDoneThatRequest({
      baseUrl: 'https://api.donethat.ai',
      resource: 'project',
      operation: 'get',
      getParameter: (name) => (name === 'projectId' ? 'p1' : ''),
      getCollection: () => ({}),
    });
    expect(req).toEqual({
      method: 'GET',
      url: 'https://api.donethat.ai/projects/p1',
      json: true,
    });
  });
});

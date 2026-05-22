import type {INode} from 'n8n-workflow';
import {NodeApiError} from 'n8n-workflow';

import {normalizeDoneThatResponse, simplifyDoneThatItems} from '../nodes/DoneThat/response';

describe('normalizeDoneThatResponse', () => {
  const node: INode = {
    id: 'test-node',
    name: 'DoneThat',
    type: 'CUSTOM.doneThat',
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  };

  it('unwraps report rows', () => {
    const rows = [{id: 'activity:1'}];
    expect(normalizeDoneThatResponse({success: true, rows}, 'report', 'get', node)).toEqual(
      rows,
    );
  });

  it('unwraps search results', () => {
    const results = [{source: 'tasks', id: 't1'}];
    expect(normalizeDoneThatResponse({success: true, results}, 'search', 'search', node)).toEqual(
      results,
    );
  });

  it('unwraps project list (getMany)', () => {
    const projects = [{id: 'p1', name: 'Alpha'}];
    expect(
      normalizeDoneThatResponse({success: true, projects}, 'project', 'getMany', node),
    ).toEqual(projects);
  });

  it('unwraps single project', () => {
    const project = {id: 'p1', name: 'Alpha'};
    expect(normalizeDoneThatResponse({success: true, project}, 'project', 'get', node)).toEqual([
      project,
    ]);
  });

  it('throws on API error string', () => {
    expect(() =>
      normalizeDoneThatResponse({success: false, error: 'forbidden'}, 'report', 'get', node),
    ).toThrow('forbidden');
  });

  it('throws generic message when error is not a string', () => {
    expect(() =>
      normalizeDoneThatResponse({success: false, error: {code: 1}}, 'report', 'get', node),
    ).toThrow('DoneThat API request failed');
  });

  it('wraps API envelopes in NodeApiError with item context and raw DoneThat body', () => {
    const body = {success: false, error: {code: 1}};

    let thrown: unknown;
    try {
      normalizeDoneThatResponse(body, 'report', 'get', node, 3);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(NodeApiError);
    expect((thrown as NodeApiError).context.itemIndex).toBe(3);
    expect((thrown as NodeApiError).context.doneThatResponse).toEqual(body);
    expect((thrown as NodeApiError).httpCode).toBeNull();
  });

  it('preserves real HTTP status fields from API envelopes', () => {
    let thrown: unknown;
    try {
      normalizeDoneThatResponse(
        {success: false, statusCode: 403, error: {code: 1}},
        'report',
        'get',
        node,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(NodeApiError);
    expect((thrown as NodeApiError).httpCode).toBe('403');
  });

  it('simplifies a day-level report row, dropping aggregated breakdowns', () => {
    const rows = [
      {
        id: 'day:2026-05-19',
        date: '2026-05-19',
        duration: 480,
        project: 'Alpha',
        category: 'Engineering',
        headline: 'Shipped n8n node',
        description: 'Polished UX, ran release',
        comment: 'Good day',
        categories: [{name: 'Engineering', minutes: 480}],
        _suppressAbsoluteDuration: false,
      },
    ];
    expect(simplifyDoneThatItems(rows, 'report')).toEqual([
      {
        id: 'day:2026-05-19',
        date: '2026-05-19',
        duration: 480,
        project: 'Alpha',
        category: 'Engineering',
        headline: 'Shipped n8n node',
        description: 'Polished UX, ran release',
      },
    ]);
  });

  it('simplifies a search result, flattening metadata into top-level fields', () => {
    const items = [
      {
        source: 'tasks',
        id: 't1',
        timestamp: '2026-05-19T10:00:00Z',
        title: 'Polish n8n node',
        snippet: 'Polished UX guidelines for the DoneThat n8n node',
        matchedFields: ['title', 'description'],
        metadata: {
          minutes: 45,
          projectId: 'p1',
          taskId: 't1',
          categoryName: 'Engineering',
          taskGroupId: 'g1',
        },
      },
    ];
    expect(simplifyDoneThatItems(items, 'search')).toEqual([
      {
        source: 'tasks',
        id: 't1',
        timestamp: '2026-05-19T10:00:00Z',
        title: 'Polish n8n node',
        snippet: 'Polished UX guidelines for the DoneThat n8n node',
        minutes: 45,
        projectId: 'p1',
        taskId: 't1',
        category: 'Engineering',
        taskGroupId: 'g1',
      },
    ]);
  });

  it('falls back to first ten scalar fields when no curated list applies', () => {
    const item: Record<string, number | string | boolean | null | object> = {
      nested: {x: 1},
      arr: [1, 2],
    };
    for (let i = 0; i < 15; i++) item[`k${i}`] = i;
    const result = simplifyDoneThatItems([item], 'project');
    expect(Object.keys(result[0])).toHaveLength(10);
    expect(result[0]).not.toHaveProperty('nested');
    expect(result[0]).not.toHaveProperty('arr');
  });

  it('unwraps message content fields', () => {
    expect(
      normalizeDoneThatResponse(
        {
          success: true,
          level: 'day',
          format: 'text',
          content: 'Summary text',
          metadata: {subject: 'Daily'},
        },
        'message',
        'get',
        node,
      ),
    ).toEqual([
      {
        level: 'day',
        format: 'text',
        content: 'Summary text',
        metadata: {subject: 'Daily'},
      },
    ]);
  });
});

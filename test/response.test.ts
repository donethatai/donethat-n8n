import {normalizeDoneThatResponse} from '../nodes/DoneThat/response';

describe('normalizeDoneThatResponse', () => {
  it('unwraps report rows', () => {
    const rows = [{id: 'activity:1'}];
    expect(normalizeDoneThatResponse({success: true, rows}, 'report', 'get')).toEqual(rows);
  });

  it('unwraps search results', () => {
    const results = [{source: 'tasks', id: 't1'}];
    expect(normalizeDoneThatResponse({success: true, results}, 'search', 'search')).toEqual(
      results,
    );
  });

  it('unwraps project list', () => {
    const projects = [{id: 'p1', name: 'Alpha'}];
    expect(normalizeDoneThatResponse({success: true, projects}, 'project', 'list')).toEqual(
      projects,
    );
  });

  it('unwraps single project', () => {
    const project = {id: 'p1', name: 'Alpha'};
    expect(normalizeDoneThatResponse({success: true, project}, 'project', 'get')).toEqual([
      project,
    ]);
  });

  it('throws on API error string', () => {
    expect(() =>
      normalizeDoneThatResponse({success: false, error: 'forbidden'}, 'report', 'get'),
    ).toThrow('forbidden');
  });

  it('throws generic message when error is not a string', () => {
    expect(() => normalizeDoneThatResponse({success: false, error: {code: 1}}, 'report', 'get')).toThrow(
      'DoneThat API request failed',
    );
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

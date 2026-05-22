import type {INode} from 'n8n-workflow';

import {searchProjectsFromResponse} from '../nodes/DoneThat/projects';

describe('searchProjectsFromResponse', () => {
  const node: INode = {
    id: 'test-node',
    name: 'DoneThat',
    type: 'CUSTOM.doneThat',
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  };

  const sample = {
    success: true,
    projects: [
      {id: 'p2', name: 'Beta'},
      {id: 'p1', name: 'Alpha'},
      {id: 'p3', name: 'Backend infra'},
    ],
  };

  it('maps projects to resource-locator list items', () => {
    expect(searchProjectsFromResponse(sample, node)).toEqual([
      {name: 'Beta', value: 'p2'},
      {name: 'Alpha', value: 'p1'},
      {name: 'Backend infra', value: 'p3'},
    ]);
  });

  it('filters by case-insensitive substring when a filter is provided', () => {
    expect(searchProjectsFromResponse(sample, node, 'b')).toEqual([
      {name: 'Beta', value: 'p2'},
      {name: 'Backend infra', value: 'p3'},
    ]);
    expect(searchProjectsFromResponse(sample, node, 'INFRA')).toEqual([
      {name: 'Backend infra', value: 'p3'},
    ]);
  });

  it('skips rows without id or name', () => {
    expect(
      searchProjectsFromResponse({
        success: true,
        projects: [{id: 'p1'}, {name: 'Orphan'}],
      }, node),
    ).toEqual([]);
  });
});

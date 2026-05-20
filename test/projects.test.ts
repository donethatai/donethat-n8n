import {searchProjectsFromResponse} from '../nodes/DoneThat/projects';

describe('searchProjectsFromResponse', () => {
  const sample = {
    success: true,
    projects: [
      {id: 'p2', name: 'Beta'},
      {id: 'p1', name: 'Alpha'},
      {id: 'p3', name: 'Backend infra'},
    ],
  };

  it('maps projects to resource-locator list items', () => {
    expect(searchProjectsFromResponse(sample)).toEqual([
      {name: 'Beta', value: 'p2'},
      {name: 'Alpha', value: 'p1'},
      {name: 'Backend infra', value: 'p3'},
    ]);
  });

  it('filters by case-insensitive substring when a filter is provided', () => {
    expect(searchProjectsFromResponse(sample, 'b')).toEqual([
      {name: 'Beta', value: 'p2'},
      {name: 'Backend infra', value: 'p3'},
    ]);
    expect(searchProjectsFromResponse(sample, 'INFRA')).toEqual([
      {name: 'Backend infra', value: 'p3'},
    ]);
  });

  it('skips rows without id or name', () => {
    expect(
      searchProjectsFromResponse({
        success: true,
        projects: [{id: 'p1'}, {name: 'Orphan'}],
      }),
    ).toEqual([]);
  });
});

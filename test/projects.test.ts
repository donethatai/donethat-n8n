import {projectOptionsFromResponse} from '../nodes/DoneThat/projects';

describe('projectOptionsFromResponse', () => {
  it('maps projects to n8n options', () => {
    expect(
      projectOptionsFromResponse({
        success: true,
        projects: [
          {id: 'p2', name: 'Beta'},
          {id: 'p1', name: 'Alpha'},
        ],
      }),
    ).toEqual([
      {name: 'Beta', value: 'p2'},
      {name: 'Alpha', value: 'p1'},
    ]);
  });

  it('skips rows without id or name', () => {
    expect(
      projectOptionsFromResponse({
        success: true,
        projects: [{id: 'p1'}, {name: 'Orphan'}],
      }),
    ).toEqual([]);
  });
});

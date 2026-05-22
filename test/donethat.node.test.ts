import {DoneThat} from '../nodes/DoneThat/DoneThat.node';
import {PROJECT_COLORS} from '../nodes/DoneThat/constants';

type SearchSourceOption = {
  name: string;
  value: string;
};

type SearchSourcesProperty = {
  name: string;
  options?: SearchSourceOption[];
  description?: string;
};

describe('DoneThat node', () => {
  it('exposes the community node description', () => {
    const node = new DoneThat();
    expect(node.description.displayName).toBe('DoneThat');
    expect(node.description.name).toBe('doneThat');
    expect(node.description.version).toBe(1);
  });

  it('documents the project color palette size', () => {
    expect(PROJECT_COLORS).toHaveLength(20);
  });

  it('exposes search sources as tasks and activity only', () => {
    const node = new DoneThat();
    const searchOptions = node.description.properties.find((property) => property.name === 'searchOptions');
    const options = searchOptions?.options as SearchSourcesProperty[] | undefined;
    const sources = options?.find((option) => option.name === 'sources');
    expect(sources?.options).toEqual([
      { name: 'Activity', value: 'activity' },
      { name: 'Tasks', value: 'tasks' },
    ]);
    expect(sources?.description).not.toContain('Screenshots');
  });
});

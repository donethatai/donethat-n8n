import {DoneThat} from '../nodes/DoneThat/DoneThat.node';
import {PROJECT_COLORS} from '../nodes/DoneThat/constants';

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
});

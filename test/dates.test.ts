import {dateToUtcEndExclusiveMs, dateToUtcStartMs} from '../nodes/DoneThat/dates';

describe('date helpers', () => {
  it('parses UTC start of day', () => {
    expect(dateToUtcStartMs('2026-05-18')).toBe(Date.parse('2026-05-18T00:00:00.000Z'));
  });

  it('computes exclusive end of day', () => {
    expect(dateToUtcEndExclusiveMs('2026-05-18')).toBe(
      dateToUtcStartMs('2026-05-18') + 24 * 60 * 60 * 1000,
    );
  });

  it('throws on invalid dates', () => {
    expect(() => dateToUtcStartMs('not-a-date')).toThrow('Invalid date');
  });
});

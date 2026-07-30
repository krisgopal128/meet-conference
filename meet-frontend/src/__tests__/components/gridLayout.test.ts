import { describe, it, expect } from 'vitest';
import { getGridDimensions, getBalancedRows } from '../../components/room/GridLayout';

describe('getGridDimensions (landscape ratios)', () => {
  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [3, 2, 2],
    [4, 2, 2],
    [5, 3, 2],
    [6, 3, 2],
    [7, 3, 3],
    [8, 3, 3],
    [9, 3, 3],
    [10, 4, 3],
    [12, 4, 3],
    [16, 4, 4],
    [17, 5, 4],
    [20, 5, 4],
    [25, 5, 5],
  ])('count=%i -> %ix%i', (count, cols, rows) => {
    expect(getGridDimensions(count, '16:9')).toEqual({ cols, rows });
  });

  it('never exceeds 5 columns (page cap is 25 tiles)', () => {
    expect(getGridDimensions(25, '16:9').cols).toBe(5);
  });
});

describe('getGridDimensions (9:16 portrait)', () => {
  it.each([
    [2, 1, 2],
    [4, 2, 2],
    [6, 2, 3],
    [8, 2, 4],
  ])('count=%i -> %ix%i', (count, cols, rows) => {
    expect(getGridDimensions(count, '9:16')).toEqual({ cols, rows });
  });
});

describe('getBalancedRows', () => {
  it.each([
    [2, 2, [2]],
    [3, 2, [2, 1]],
    [5, 3, [3, 2]],
    [7, 3, [3, 2, 2]],
    [8, 3, [3, 3, 2]],
    [10, 4, [4, 3, 3]],
    [13, 4, [4, 3, 3, 3]],
    [25, 5, [5, 5, 5, 5, 5]],
  ])('count=%i cols=%i -> %j', (count, cols, expected) => {
    expect(getBalancedRows(count, cols)).toEqual(expected);
  });

  it('row sizes always sum to the tile count', () => {
    for (let count = 1; count <= 25; count++) {
      const { cols } = getGridDimensions(count, '16:9');
      const rows = getBalancedRows(count, cols);
      expect(rows.reduce((a, b) => a + b, 0)).toBe(count);
      expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(1);
    }
  });

  it('handles degenerate inputs', () => {
    expect(getBalancedRows(0, 3)).toEqual([]);
    expect(getBalancedRows(5, 0)).toEqual([]);
  });
});

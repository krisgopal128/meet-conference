import { describe, it, expect, beforeEach } from 'vitest';
import { cn } from '../../utils/cn';

describe('cn utility function', () => {
  beforeEach(() => {
    // Clear cache before each test
    (cn as any).__cache?.clear();
  });

  it('merges simple string classes', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('handles conditional classes with undefined', () => {
    expect(cn('class1', undefined, 'class2')).toBe('class1 class2');
  });

  it('handles conditional classes with null', () => {
    expect(cn('class1', null, 'class2')).toBe('class1 class2');
  });

  it('handles conditional classes with false', () => {
    expect(cn('class1', false, 'class2')).toBe('class1 class2');
  });

  it('includes classes when condition is true', () => {
    expect(cn('class1', true && 'class2')).toBe('class1 class2');
  });

  it('excludes classes when condition is false', () => {
    expect(cn('class1', false && 'class2')).toBe('class1');
  });

  it('handles array inputs', () => {
    expect(cn(['class1', 'class2'])).toBe('class1 class2');
  });

  it('handles object inputs with boolean values', () => {
    expect(cn({ class1: true, class2: false, class3: true })).toBe('class1 class3');
  });

  it('merges Tailwind conflict classes correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('keeps non-conflicting classes', () => {
    expect(cn('p-4', 'bg-blue-500')).toBe('p-4 bg-blue-500');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('handles mixed input types', () => {
    expect(cn('class1', ['class2', 'class3'], { class4: true })).toBe('class1 class2 class3 class4');
  });

  it('returns consistent results for same inputs (caching)', () => {
    const inputs = ['class1', 'class2'];
    const result1 = cn(...inputs);
    const result2 = cn(...inputs);
    expect(result1).toBe(result2);
  });

  it('caches results for frequently-used class combinations', () => {
    const inputs = ['p-4', 'bg-blue-500', 'rounded'];
    const result1 = cn(...inputs);
    const result2 = cn(...inputs);
    expect(result1).toBe(result2);
    expect(result1).toBe('p-4 bg-blue-500 rounded');
  });
});

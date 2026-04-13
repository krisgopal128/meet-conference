import { describe, it, expect } from 'vitest';
import { cn } from '../../utils/cn';

describe('cn utility', () => {
  describe('single class', () => {
    it('should return a single class name', () => {
      expect(cn('btn')).toBe('btn');
    });

    it('should handle single class with prefix', () => {
      expect(cn('bg-blue-500')).toBe('bg-blue-500');
    });

    it('should handle empty string', () => {
      expect(cn('')).toBe('');
    });
  });

  describe('multiple classes', () => {
    it('should merge multiple class names', () => {
      expect(cn('btn', 'btn-primary')).toBe('btn btn-primary');
    });

    it('should merge three class names', () => {
      expect(cn('flex', 'items-center', 'justify-between')).toBe('flex items-center justify-between');
    });

    it('should merge many class names', () => {
      const result = cn('flex', 'flex-col', 'gap-4', 'p-4', 'bg-white', 'rounded-lg', 'shadow');
      expect(result).toBe('flex flex-col gap-4 p-4 bg-white rounded-lg shadow');
    });

    it('should handle array of classes', () => {
      expect(cn(['btn', 'btn-primary'])).toBe('btn btn-primary');
    });
  });

  describe('conditional classes', () => {
    it('should include class when condition is true', () => {
      expect(cn('btn', { 'btn-active': true })).toBe('btn btn-active');
    });

    it('should exclude class when condition is false', () => {
      expect(cn('btn', { 'btn-active': false })).toBe('btn');
    });

    it('should handle multiple conditional classes', () => {
      expect(cn('btn', {
        'btn-active': true,
        'btn-disabled': false,
        'btn-large': true,
      })).toBe('btn btn-active btn-large');
    });

    it('should handle all conditions being false', () => {
      expect(cn('btn', {
        'btn-active': false,
        'btn-disabled': false,
      })).toBe('btn');
    });

    it('should handle mixed static and conditional classes', () => {
      expect(cn(
        'base-class',
        'another-class',
        { 'conditional-true': true },
        { 'conditional-false': false }
      )).toBe('base-class another-class conditional-true');
    });
  });

  describe('tailwind-merge functionality', () => {
    it('should merge conflicting tailwind classes (later wins)', () => {
      // tailwind-merge should resolve conflicts
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });

    it('should merge conflicting background colors', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('should merge conflicting text colors', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('should keep non-conflicting classes', () => {
      expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
    });

    it('should handle complex merge scenarios', () => {
      expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
    });
  });

  describe('mixed input types', () => {
    it('should handle strings, objects, and arrays mixed', () => {
      const result = cn(
        'base',
        ['array-class'],
        { 'object-class': true },
        'final'
      );
      expect(result).toBe('base array-class object-class final');
    });

    it('should handle undefined values', () => {
      expect(cn('btn', undefined)).toBe('btn');
    });

    it('should handle null values', () => {
      expect(cn('btn', null)).toBe('btn');
    });

    it('should handle nested arrays', () => {
      expect(cn(['outer', ['inner']])).toBe('outer inner');
    });

    it('should filter out falsy values', () => {
      expect(cn('btn', false, null, undefined, '')).toBe('btn');
    });
  });

  describe('real-world use cases', () => {
    it('should handle button variant pattern', () => {
      const isPrimary = true;
      const isDisabled = false;
      const isLarge = true;
      
      expect(cn(
        'btn',
        isPrimary && 'btn-primary',
        isDisabled && 'btn-disabled',
        isLarge && 'btn-lg'
      )).toBe('btn btn-primary btn-lg');
    });

    it('should handle card component pattern', () => {
      const isActive = true;
      
      expect(cn(
        'card',
        'p-4',
        'rounded-lg',
        isActive && 'border-2 border-blue-500'
      )).toBe('card p-4 rounded-lg border-2 border-blue-500');
    });

    it('should handle form input pattern', () => {
      const hasError = true;
      const isTouched = true;
      
      expect(cn(
        'input',
        'w-full',
        hasError && isTouched && 'input-error'
      )).toBe('input w-full input-error');
    });
  });
});

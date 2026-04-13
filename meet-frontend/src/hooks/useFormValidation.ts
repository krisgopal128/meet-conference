/**
 * useFormValidation - Shared form validation hook for auth forms
 * 
 * Provides touched state tracking and inline error computation,
 * avoiding separate useEffect hooks for each field.
 */

import { useMemo } from 'react';

export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
}

export function useFormValidation<T extends Record<string, unknown>>(
  values: T,
  touched: Record<keyof T, boolean>,
  rules: Partial<Record<keyof T, ValidationRule<T[keyof T]>[]>>
): Record<keyof T, string> {
  return useMemo(() => {
    const errors: Partial<Record<keyof T, string>> = {};
    
    for (const field in rules) {
      if (touched[field]) {
        const fieldRules = rules[field];
        if (fieldRules) {
          const value = values[field];
          const failedRule = fieldRules.find(rule => !rule.validate(value));
          errors[field] = failedRule?.message || '';
        }
      } else {
        errors[field] = '';
      }
    }
    
    return errors as Record<keyof T, string>;
  }, [values, touched, rules]);
}

// Simplified hook for common auth form pattern
export function useAuthFormValidation(fields: {
  name?: string;
  email: string;
  password: string;
  confirmPassword?: string;
}, touched: {
  name?: boolean;
  email: boolean;
  password: boolean;
  confirmPassword?: boolean;
}) {
  const nameError = touched.name ? (
    !fields.name?.trim() ? 'Name is required' :
    (fields.name?.trim().length ?? 0) < 2 ? 'Name must be at least 2 characters' : ''
  ) : '';

  const emailError = touched.email ? (
    !fields.email.trim() ? 'Email is required' :
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ? 'Please enter a valid email' : ''
  ) : '';

  const passwordError = touched.password ? (
    !fields.password ? 'Password is required' :
    fields.password.length < 6 ? 'Password must be at least 6 characters' : ''
  ) : '';

  const confirmError = touched.confirmPassword ? (
    !fields.confirmPassword ? 'Please confirm your password' :
    fields.confirmPassword !== fields.password ? 'Passwords do not match' : ''
  ) : '';

  return { nameError, emailError, passwordError, confirmError };
}

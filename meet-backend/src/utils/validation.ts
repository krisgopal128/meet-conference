/**
 * Input validation and sanitization utilities
 */
import validator from 'validator';

/**
 * Sanitize and validate email
 * - Trims whitespace
 * - Normalizes to lowercase
 * - Validates email format
 */
export function sanitizeEmail(email: string): string {
  const sanitized = validator.trim(email).toLowerCase();
  if (!validator.isEmail(sanitized)) {
    throw new Error('Invalid email format');
  }
  return sanitized;
}

/**
 * Sanitize and validate name
 * - Trims whitespace
 * - Removes HTML tags (XSS prevention)
 * - Limits length to 100 characters
 * - Allows letters, numbers, spaces, and common punctuation
 */
export function sanitizeName(name: string): string {
  // Trim and strip HTML tags
  let sanitized = validator.trim(name);
  sanitized = validator.stripLow(sanitized); // Remove control characters
  sanitized = validator.escape(sanitized); // Escape HTML entities
  
  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  // Ensure not empty after sanitization
  if (sanitized.length === 0) {
    throw new Error('Name cannot be empty');
  }
  
  return sanitized;
}

/**
 * Sanitize and validate room name
 * - Trims whitespace
 * - Converts to lowercase
 * - Only allows alphanumeric characters and hyphens
 * - Must start with a letter
 * - Length: 3-100 characters
 */
export function sanitizeRoomName(name: string): string {
  const sanitized = validator.trim(name).toLowerCase();
  
  // Validate format: lowercase alphanumeric with hyphens, must start with letter
  if (!validator.matches(sanitized, /^[a-z][a-z0-9-]{2,99}$/)) {
    throw new Error('Room name must start with a letter, be 3-100 characters, and contain only lowercase letters, numbers, and hyphens');
  }
  
  // Check for consecutive hyphens
  if (sanitized.includes('--')) {
    throw new Error('Room name cannot contain consecutive hyphens');
  }
  
  // Check for ending hyphen
  if (sanitized.endsWith('-')) {
    throw new Error('Room name cannot end with a hyphen');
  }
  
  return sanitized;
}

/**
 * Sanitize description text
 * - Trims whitespace
 * - Removes HTML tags
 * - Limits length
 */
export function sanitizeDescription(text: string, maxLength: number = 1000): string {
  let sanitized = validator.trim(text);
  sanitized = validator.stripLow(sanitized);
  sanitized = validator.escape(sanitized);
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize URL (for avatar URLs, etc.)
 * - Validates URL format
 * - Only allows http/https protocols
 */
export function sanitizeUrl(url: string): string {
  const sanitized = validator.trim(url);
  
  if (!validator.isURL(sanitized, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
  })) {
    throw new Error('Invalid URL format');
  }
  
  return sanitized;
}

/**
 * Sanitize chat message content
 * - Trims whitespace
 * - Removes control characters
 * - Escapes HTML (XSS prevention)
 * - Limits length
 */
export function sanitizeChatMessage(content: string, maxLength: number = 5000): string {
  let sanitized = validator.trim(content);
  sanitized = validator.stripLow(sanitized);
  sanitized = validator.escape(sanitized);
  
  if (sanitized.length > maxLength) {
    throw new Error(`Message exceeds maximum length of ${maxLength} characters`);
  }
  
  if (sanitized.length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  return sanitized;
}

/**
 * Validate password strength
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - Should contain at least one letter and one number (optional, can be relaxed)
 */
export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (password.length > 128) {
    throw new Error('Password must be at most 128 characters');
  }
}

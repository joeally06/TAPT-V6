/**
 * Input Sanitization Utilities
 * Protects against XSS, SQL injection, and other attacks
 */

/**
 * Sanitize a string input
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove potential HTML/script tags and event handlers
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
  
  return sanitized;
}

/**
 * Sanitize and validate email address
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email, 255).toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }
  
  return sanitized;
}

/**
 * Sanitize and validate phone number
 */
export function sanitizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Validate length (10 digits for US phone numbers)
  if (digits.length !== 10) {
    throw new Error('Phone number must be exactly 10 digits');
  }
  
  return digits;
}

/**
 * Sanitize and validate ZIP code
 */
export function sanitizeZipCode(zip: string): string {
  const sanitized = zip.trim();
  
  // Allow 5-digit or 5+4 digit format
  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (!zipRegex.test(sanitized)) {
    throw new Error('Invalid ZIP code format');
  }
  
  return sanitized;
}

/**
 * Sanitize and validate URL
 */
export function sanitizeUrl(url: string): string {
  const sanitized = sanitizeString(url, 2048);
  
  try {
    const parsed = new URL(sanitized);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL protocol');
    }
    return parsed.toString();
  } catch {
    throw new Error('Invalid URL format');
  }
}

/**
 * Sanitize and validate number
 */
export function sanitizeNumber(value: any, min?: number, max?: number): number {
  const num = Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid number');
  }
  
  if (min !== undefined && num < min) {
    throw new Error(`Number must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    throw new Error(`Number must not exceed ${max}`);
  }
  
  return num;
}

/**
 * Sanitize boolean value
 */
export function sanitizeBoolean(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  
  throw new Error('Invalid boolean value');
}

/**
 * Sanitize array
 */
export function sanitizeArray(arr: any[], maxLength: number = 100): any[] {
  if (!Array.isArray(arr)) {
    throw new Error('Input must be an array');
  }
  
  if (arr.length > maxLength) {
    throw new Error(`Array exceeds maximum length of ${maxLength}`);
  }
  
  return arr;
}

/**
 * Sanitize US state code (2-letter abbreviation)
 */
export function sanitizeState(state: string): string {
  const sanitized = sanitizeString(state, 2).toUpperCase();
  
  // Validate it's exactly 2 letters
  if (!/^[A-Z]{2}$/.test(sanitized)) {
    throw new Error('State must be a 2-letter code');
  }
  
  return sanitized;
}

/**
 * Schema-based object sanitization
 */
export interface SanitizationRule {
  type: 'string' | 'email' | 'phone' | 'zip' | 'url' | 'number' | 'boolean' | 'array' | 'state';
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  arrayMaxLength?: number;
}

export function sanitizeObject<T extends Record<string, any>>(
  obj: any,
  schema: Record<string, SanitizationRule>
): Partial<T> {
  const sanitized: any = {};
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      throw new Error(`${key} is required`);
    }
    
    // Skip optional fields that are not provided
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Sanitize based on type
    try {
      switch (rules.type) {
        case 'string':
          sanitized[key] = sanitizeString(value, rules.maxLength);
          break;
        case 'email':
          sanitized[key] = sanitizeEmail(value);
          break;
        case 'phone':
          sanitized[key] = sanitizePhone(value);
          break;
        case 'zip':
          sanitized[key] = sanitizeZipCode(value);
          break;
        case 'state':
          sanitized[key] = sanitizeState(value);
          break;
        case 'url':
          sanitized[key] = sanitizeUrl(value);
          break;
        case 'number':
          sanitized[key] = sanitizeNumber(value, rules.min, rules.max);
          break;
        case 'boolean':
          sanitized[key] = sanitizeBoolean(value);
          break;
        case 'array':
          sanitized[key] = sanitizeArray(value, rules.arrayMaxLength);
          break;
        default:
          throw new Error(`Unknown type: ${rules.type}`);
      }
    } catch (error) {
      throw new Error(`Invalid ${key}: ${error instanceof Error ? error.message : 'validation failed'}`);
    }
  }
  
  return sanitized as Partial<T>;
}

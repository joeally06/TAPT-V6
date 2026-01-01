/**
 * Request ID Tracking Utilities
 * 
 * Generates unique request IDs for tracking requests across frontend and backend.
 * Each request gets a unique identifier that can be used for:
 * - Tracing requests through the entire system
 * - Correlating frontend actions with backend logs
 * - Debugging and error tracking
 * - Audit trail correlation
 * 
 * @module requestId
 */

/**
 * Generates a unique request ID using crypto.randomUUID()
 * This runs client-side for request tracking purposes only
 */
export function generateRequestId(): string {
  // Use browser's native crypto API for unique IDs
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers (should rarely be needed)
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

/**
 * Adds request ID header to existing headers
 * 
 * @param headers - Existing headers object (optional)
 * @param requestId - Request ID to add (optional, generates new one if not provided)
 * @returns Headers object with X-Request-ID added
 * 
 * @example
 * ```typescript
 * const headers = addRequestIdHeader({ 'Content-Type': 'application/json' });
 * ```
 */
export function addRequestIdHeader(
  headers: HeadersInit = {},
  requestId?: string
): HeadersInit {
  const id = requestId || generateRequestId();
  
  return {
    ...headers,
    'X-Request-ID': id
  };
}

/**
 * React hook for generating and managing request IDs
 * 
 * @returns Object with requestId and regenerate function
 * 
 * @example
 * ```typescript
 * const { requestId, regenerate } = useRequestId();
 * 
 * // Use in API calls
 * await fetch('/api/endpoint', {
 *   headers: addRequestIdHeader({}, requestId)
 * });
 * ```
 */
export function useRequestId(): { requestId: string; regenerate: () => string } {
  const [requestId, setRequestId] = React.useState<string>(generateRequestId());
  
  const regenerate = React.useCallback(() => {
    const newId = generateRequestId();
    setRequestId(newId);
    return newId;
  }, []);
  
  return { requestId, regenerate };
}

// Re-export for convenience
import React from 'react';

/**
 * Extracts request ID from response headers
 * Useful for logging or error handling
 */
export function extractRequestId(response: Response): string | null {
  return response.headers.get('X-Request-ID');
}

/**
 * Creates a request context object with metadata
 * Useful for logging and debugging
 */
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  userAgent?: string;
  url?: string;
}

export function createRequestContext(requestId?: string): RequestContext {
  return {
    requestId: requestId || generateRequestId(),
    timestamp: new Date(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  };
}

/**
 * Logs request with context for debugging
 */
export function logRequest(
  action: string,
  context: RequestContext,
  additionalData?: Record<string, any>
): void {
  if (import.meta.env.DEV) {
    console.log(`[Request ${context.requestId}]`, {
      action,
      timestamp: context.timestamp.toISOString(),
      url: context.url,
      ...additionalData
    });
  }
}

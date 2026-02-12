/**
 * Request ID Middleware for Supabase Edge Functions
 * 
 * Extracts and validates request IDs from incoming requests
 * Ensures all requests have a unique identifier for tracking
 * 
 * @module requestId
 */

/**
 * Extracts request ID from request headers
 * Generates a new one if not present
 * 
 * @param req - The incoming request
 * @returns Request ID string
 */
export function getRequestId(req: Request): string {
  const requestId = req.headers.get('X-Request-ID') || 
                   req.headers.get('x-request-id');
  
  if (requestId) {
    return requestId;
  }
  
  // Generate new request ID if not provided
  return `req_${Date.now()}_${crypto.randomUUID()}`;
}

/**
 * Adds request ID to response headers
 * 
 * @param headers - Existing headers object
 * @param requestId - Request ID to add
 * @returns Headers with request ID added
 */
export function addRequestIdToResponse(
  headers: HeadersInit,
  requestId: string
): HeadersInit {
  return {
    ...headers,
    'X-Request-ID': requestId
  };
}

/**
 * Creates a standard success response with request ID
 * 
 * @param data - Response data
 * @param requestId - Request ID
 * @param status - HTTP status code (default: 200)
 * @returns Response object
 */
export function createSuccessResponse(
  data: any,
  requestId: string,
  status: number = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        ...extraHeaders,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      }
    }
  );
}

/**
 * Creates a standard error response with request ID
 * 
 * @param error - Error message or Error object
 * @param requestId - Request ID
 * @param status - HTTP status code (default: 500)
 * @returns Response object
 */
export function createErrorResponse(
  error: string | Error,
  requestId: string,
  status: number = 500,
  extraHeaders: Record<string, string> = {}
): Response {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        ...extraHeaders,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      }
    }
  );
}

/**
 * Logs request with request ID
 * 
 * @param requestId - Request ID
 * @param action - Action being performed
 * @param data - Additional data to log
 */
export function logWithRequestId(
  requestId: string,
  action: string,
  data?: any
): void {
  console.log(`[Request ${requestId}] ${action}`, data || '');
}

/**
 * Logs error with request ID
 * 
 * @param requestId - Request ID
 * @param action - Action that failed
 * @param error - Error object or message
 */
export function logErrorWithRequestId(
  requestId: string,
  action: string,
  error: any
): void {
  console.error(`[Request ${requestId}] ERROR: ${action}`, error);
}

/**
 * Interface for request context
 */
export interface EdgeRequestContext {
  requestId: string;
  timestamp: Date;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Creates request context from incoming request
 * 
 * @param req - Incoming request
 * @param requestId - Request ID (optional, will be extracted if not provided)
 * @returns Request context object
 */
export function createEdgeRequestContext(
  req: Request,
  requestId?: string
): EdgeRequestContext {
  const id = requestId || getRequestId(req);
  
  return {
    requestId: id,
    timestamp: new Date(),
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent') || undefined,
    ip: req.headers.get('x-forwarded-for') || 
        req.headers.get('x-real-ip') || 
        undefined
  };
}

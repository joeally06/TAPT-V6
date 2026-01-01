import { createClient } from '@supabase/supabase-js';
import { addRequestIdHeader, generateRequestId, logRequest, createRequestContext } from './requestId';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// Test function
export const testSupabaseConnection = async (): Promise<{ success: boolean; error?: Error }> => {
  try {
    // Try to access a table to verify the connection
    const { error } = await supabase
      .from('conference_registrations')
      .select('count')
      .limit(1)
      .single();
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Unknown connection error') 
    };
  }
};

// Function to verify user role
export const verifyUserRole = async (userId: string): Promise<string | null> => {
  try {
    console.log('Verifying user role for ID:', userId);
    
    if (!userId) {
      console.error('No userId provided to verifyUserRole');
      return null;
    }

    // Use RPC call to avoid RLS recursion
    const { data, error } = await supabase.rpc('get_user_role', {
      user_id: userId
    });

    if (error) {
      console.error('Error fetching user role:', error);
      throw error;
    }

    if (!data) {
      console.log('No user data found for ID:', userId);
      return null;
    }

    console.log('User role found:', data);
    return data;

  } catch (error) {
    console.error('Error in verifyUserRole:', error);
    return null;
  }
};

/**
 * Wrapper for Supabase Edge Function calls with request ID tracking
 * 
 * @param functionName - Name of the Edge Function to invoke
 * @param data - Data to send to the function
 * @param requestId - Optional request ID (generates new one if not provided)
 * @returns Promise with function response
 * 
 * @example
 * ```typescript
 * const result = await invokeEdgeFunction('submit-contact-message', {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   message: 'Hello'
 * });
 * ```
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  data: any,
  requestId?: string
): Promise<{ data: T | null; error: Error | null; requestId: string }> {
  const id = requestId || generateRequestId();
  const context = createRequestContext(id);
  
  try {
    logRequest(`Invoking Edge Function: ${functionName}`, context, { data });
    
    const { data: responseData, error } = await supabase.functions.invoke<T>(functionName, {
      body: data,
      headers: addRequestIdHeader({}, id)
    });

    if (error) {
      console.error(`[Request ${id}] Edge Function error:`, error);
      return { data: null, error, requestId: id };
    }

    logRequest(`Edge Function success: ${functionName}`, context, { response: responseData });
    return { data: responseData, error: null, requestId: id };
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error(`[Request ${id}] Exception invoking Edge Function:`, err);
    return { data: null, error: err, requestId: id };
  }
}

/**
 * Enhanced fetch wrapper with request ID tracking
 * Use this for custom API calls outside of Supabase Edge Functions
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param requestId - Optional request ID
 * @returns Promise with fetch response
 */
export async function fetchWithRequestId(
  url: string,
  options: RequestInit = {},
  requestId?: string
): Promise<Response> {
  const id = requestId || generateRequestId();
  const context = createRequestContext(id);
  
  logRequest(`Fetching: ${url}`, context);
  
  const headers = addRequestIdHeader(options.headers || {}, id);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Log response status
    if (import.meta.env.DEV) {
      console.log(`[Request ${id}] Response status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    console.error(`[Request ${id}] Fetch error:`, error);
    throw error;
  }
}
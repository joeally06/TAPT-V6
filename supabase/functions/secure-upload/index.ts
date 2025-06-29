import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  'https://tapt.org',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
  // Add WebContainer domains
  'https://*.webcontainer-api.io',
  'http://*.webcontainer-api.io'
];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'"
};

interface UploadRequest {
  fileName: string;
  contentType: string;
  bucket: 'private' | 'public';
  folder: string;
}

// Helper to log upload actions
type UploadLogEntry = {
  action: string;
  user_id: string | null;
  outcome: 'success' | 'failure';
  error?: string;
  bucket?: string | null;
  folder?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  filePath?: string | null;
};
async function logUploadAction(supabaseAdmin: any, entry: UploadLogEntry) {
  try {
    await supabaseAdmin.from('upload_audit').insert([
      {
        action: entry.action,
        user_id: entry.user_id,
        outcome: entry.outcome,
        error: entry.error || null,
        bucket: entry.bucket || null,
        folder: entry.folder || null,
        file_name: entry.fileName || null,
        content_type: entry.contentType || null,
        file_path: entry.filePath || null,
        timestamp: new Date().toISOString(),
      },
    ]);
    // TODO: Integrate alerting/monitoring for repeated failures
  } catch (e) {
    // Logging failure should not block main flow
  }
}

// Utility to sanitize error messages
const sanitizeError = (error: any): string => {
  const errorMap: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/wrong-password': 'Invalid login credentials.',
    '23505': 'A record with this information already exists.',
    '22P02': 'Invalid input format.',
    '23503': 'Related record not found.',
    '23514': 'Input does not meet requirements.',
  };
  
  if (error && typeof error === 'object') {
    if (error.code && errorMap[error.code]) return errorMap[error.code];
    if (error.message && errorMap[error.message]) return errorMap[error.message];
  }
  
  return 'An unexpected error occurred. Please try again.';
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  // Check if origin matches any allowed pattern (including wildcards)
  const allowOrigin = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  }) ? origin : '';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { fileName, contentType, bucket, folder }: UploadRequest = await req.json();

    // Validate request
    if (!fileName || !contentType || !bucket || !folder) {
      throw new Error('Missing required fields');
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];

    if (!allowedTypes.includes(contentType)) {
      throw new Error('Invalid file type');
    }

    // Enforce folder structure for private bucket
    if (bucket === 'private') {
      if (folder !== user.id) {
        throw new Error('Invalid folder: must match your user ID');
      }
    }

    // Optionally, restrict uploads to public bucket to only non-sensitive file types (add logic here if needed)

    // Generate secure file path
    const fileExt = fileName.split('.').pop();
    const secureFileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${folder}/${secureFileName}`;

    // Log upload attempt (for auditing)
    console.log(`User ${user.id} uploading to bucket: ${bucket}, folder: ${folder}, file: ${fileName}, type: ${contentType}`);
    await logUploadAction(supabaseAdmin, {
      action: 'secure_upload',
      user_id: user.id,
      outcome: 'success',
      bucket,
      folder,
      fileName,
      contentType,
      filePath
    });

    // Get signed URL for upload
    const { data: signedUrl, error: signedUrlError } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (signedUrlError) {
      throw signedUrlError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        signedUrl: signedUrl.signedUrl,
        path: filePath
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    // Sanitize error before returning to client
    console.error('Error:', error.message);
    try {
      // Try to log the failed upload attempt
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
      let userId = null, bucket = null, folder = null, fileName = null, contentType = null, filePath = null;
      try {
        const body = await req.json();
        bucket = body.bucket || null;
        folder = body.folder || null;
        fileName = body.fileName || null;
        contentType = body.contentType || null;
        // filePath can't be reliably reconstructed on error
      } catch {}
      await logUploadAction(supabaseAdmin, {
        action: 'secure_upload',
        user_id: userId,
        outcome: 'failure',
        error: error.message,
        bucket: bucket || undefined,
        folder: folder || undefined,
        fileName: fileName || undefined,
        contentType: contentType || undefined,
        filePath: filePath || undefined
      });
    } catch {}
    return new Response(
      JSON.stringify({
        success: false,
        error: sanitizeError(error),
      }),
      { 
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
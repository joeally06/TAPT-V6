/**
 * Request ID Test Component
 * 
 * Tests the request ID tracking functionality across frontend and backend
 */

import React, { useState } from 'react';
import { generateRequestId, useRequestId, createRequestContext } from '../lib/requestId';
import { invokeEdgeFunction } from '../lib/supabase';

export function RequestIdTest() {
  const { requestId, regenerate } = useRequestId();
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testRequestIdFlow = async () => {
    setLoading(true);
    setTestResult('Testing request ID flow...');

    try {
      const context = createRequestContext(requestId);
      console.log('Test Request Context:', context);

      // Test 1: Generate request ID
      const newId = generateRequestId();
      console.log('Generated Request ID:', newId);

      // Test 2: Call Edge Function with request ID
      const { data, error, requestId: returnedId } = await invokeEdgeFunction(
        'submit-contact-message',
        {
          name: 'Test User',
          email: 'test@example.com',
          message: 'Testing request ID tracking',
          turnstileToken: 'test-token'
        },
        requestId
      );

      if (error) {
        setTestResult(`❌ Error: ${error.message}\nRequest ID: ${returnedId}`);
      } else {
        setTestResult(
          `✅ Success!\n\n` +
          `Sent Request ID: ${requestId}\n` +
          `Returned Request ID: ${returnedId}\n` +
          `Match: ${requestId === returnedId ? 'Yes ✓' : 'No ✗'}\n\n` +
          `Response Data: ${JSON.stringify(data, null, 2)}`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setTestResult(`❌ Exception: ${message}\nRequest ID: ${requestId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Request ID Test</h2>
        
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <p className="text-sm font-semibold mb-2">Current Request ID:</p>
          <p className="font-mono text-sm break-all">{requestId}</p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={testRequestIdFlow}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Testing...' : 'Test Request ID Flow'}
          </button>
          
          <button
            onClick={() => {
              regenerate();
              setTestResult('');
            }}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
          >
            Generate New ID
          </button>
        </div>

        {testResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm font-semibold mb-2">Test Result:</p>
            <pre className="text-xs whitespace-pre-wrap font-mono">{testResult}</pre>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded">
          <h3 className="font-semibold mb-2">How it works:</h3>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Frontend generates unique request ID</li>
            <li>Request ID sent in X-Request-ID header</li>
            <li>Edge Function extracts and logs request ID</li>
            <li>Request ID included in response</li>
            <li>Request ID stored in audit logs</li>
          </ol>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 rounded text-sm">
          <p className="font-semibold mb-1">⚠️ Note:</p>
          <p>This test will fail without proper Turnstile verification. Check browser console and Edge Function logs for request ID tracking.</p>
        </div>
      </div>
    </div>
  );
}

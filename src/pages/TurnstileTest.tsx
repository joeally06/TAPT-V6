import React from 'react';
import { SecureForm } from '../components/forms/SecureForm';

export const TurnstileTest: React.FC = () => {
  const handleTestSubmit = async (formData: any, isVerified: boolean, turnstileToken?: string) => {
    console.log('🔒 Form Data:', formData);
    console.log('🔒 Verification Status:', isVerified);
    console.log('🔒 Turnstile Token:', turnstileToken ? turnstileToken.substring(0, 20) + '...' : 'None');
    
    if (isVerified && turnstileToken) {
      alert('✅ Security verification successful! Form would be submitted.');
    } else {
      alert('❌ Security verification failed!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Turnstile Test Form</h1>
        <p className="text-gray-600 mb-6">
          This form tests the Cloudflare Turnstile integration. Fill out the form and complete the security challenge.
        </p>
        
        <SecureForm 
          onSubmit={handleTestSubmit}
          className="space-y-4"
          requireTurnstile={true}
        >
          <div>
            <label htmlFor="test-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="test-name"
              name="name"
              required
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your name"
            />
          </div>
          
          <div>
            <label htmlFor="test-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="test-email"
              name="email"
              required
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>
          
          <div>
            <label htmlFor="test-message" className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              id="test-message"
              name="message"
              required
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your message"
            />
          </div>
        </SecureForm>
        
        <div className="mt-6 text-sm text-gray-500">
          <p><strong>Security Features:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Cloudflare Turnstile verification</li>
            <li>Domain validation</li>
            <li>Rate limiting (5 attempts per 15 minutes)</li>
            <li>Timestamp validation</li>
            <li>Backend token verification</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

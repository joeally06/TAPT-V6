import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, DollarSign, Building, User, Users, Calendar, AlertCircle, X } from 'lucide-react';
import { SecureForm } from '../components/forms/SecureForm';

interface Attendee {
  firstName: string;
  lastName: string;
  email: string;
}

interface TechConferenceSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  registration_end_date: string;
  location: string;
  venue: string;
  fee: number;
  payment_instructions: string;
  description: string;
  is_active: boolean;
}

const TechConferenceRegistration: React.FC = () => {
  const [formData, setFormData] = useState({
    schoolDistrict: '',
    firstName: '',
    lastName: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    email: '',
    phone: '',
    totalAttendees: 1,
    additionalAttendees: [] as Attendee[]
  });


  const [formStatus, setFormStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  const [conferenceSettings, setConferenceSettings] = useState<TechConferenceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false);
  const [showUnavailablePopup, setShowUnavailablePopup] = useState(false);

  useEffect(() => {
    fetchConferenceSettings();
  }, []);

  const fetchConferenceSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tech_conference_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle instead of single

      if (error) {
        console.error('Error fetching tech conference settings:', error);
        setShowUnavailablePopup(true);
        return;
      }

      if (!data) {
        setShowUnavailablePopup(true);
        return;
      }

      setConferenceSettings(data);

      // Check if registration deadline has passed
      if (data.registration_end_date) {
        const endDate = new Date(data.registration_end_date);
        const now = new Date();
        
        if (now > endDate) {
          setIsRegistrationClosed(true);
        } else {
          setIsRegistrationClosed(false);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setShowUnavailablePopup(true);
    } finally {
      setLoading(false);
    }
  };

  const registrationFee = conferenceSettings?.fee ?? 250.00;
  const totalAmount = formData.totalAttendees * registrationFee;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'totalAttendees') {
      const attendees = Math.max(1, parseInt(value) || 1);
      const currentAttendees = formData.additionalAttendees;
      
      if (attendees > 1) {
        const diff = attendees - 1 - currentAttendees.length;
        if (diff > 0) {
          const newAttendees = [...currentAttendees];
          for (let i = 0; i < diff; i++) {
            newAttendees.push({ firstName: '', lastName: '', email: '' });
          }
          setFormData(prev => ({
            ...prev,
            [name]: attendees,
            additionalAttendees: newAttendees
          }));
        } else if (diff < 0) {
          setFormData(prev => ({
            ...prev,
            [name]: attendees,
            additionalAttendees: currentAttendees.slice(0, attendees - 1)
          }));
        }
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: attendees,
          additionalAttendees: []
        }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAttendeeChange = (index: number, field: keyof Attendee, value: string) => {
    setFormData(prev => {
      const newAttendees = [...prev.additionalAttendees];
      newAttendees[index] = { ...newAttendees[index], [field]: value };
      return { ...prev, additionalAttendees: newAttendees };
    });
  };

  const handleSecureSubmit = async (data: any, isVerified: boolean, turnstileToken?: string) => {
    if (!conferenceSettings?.is_active) {
      throw new Error('Registration is not currently available.');
    }

    if (isRegistrationClosed) {
      throw new Error('Registration is closed. The deadline has passed.');
    }

    try {
      // Debug: Log the turnstile token
      console.log('🔒 Turnstile token received:', turnstileToken ? 'Token present' : 'No token');
      console.log('🔒 Token length:', turnstileToken?.length || 0);
      
      // Ensure we have a valid turnstile token
      if (!turnstileToken) {
        throw new Error('Security verification failed. Please try again.');
      }
      
      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL environment variable is not defined');
      }

      // Prepare the request payload
      const payload = {
        schoolDistrict: formData.schoolDistrict,
        firstName: formData.firstName,
        lastName: formData.lastName,
        streetAddress: formData.streetAddress,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        email: formData.email,
        phone: formData.phone,
        totalAttendees: formData.totalAttendees,
        totalAmount,
        conferenceId: conferenceSettings?.id, // ✅ Added missing conferenceId
        additionalAttendees: formData.additionalAttendees,
        turnstileToken
      };

      // Debug: Log payload (without sensitive data)
      console.log('📤 Sending payload:', {
        ...payload,
        turnstileToken: payload.turnstileToken ? 'Token present' : 'No token'
      });

      // Make the request to the Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-tech-conference-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });

      // Check if the request was successful
      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Server communication error. Please try again.');
      }

      // Debug: Log response details
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', result);

      if (!response.ok) {
        throw new Error(result?.error || `Server error (${response.status}). Please try again.`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Registration failed. Please try again.');
      }

      // ✅ Only show success message via formStatus
      setFormStatus({
        success: true,
        message: 'Registration submitted successfully! Please mail your payment as instructed.'
      });
      
      // Reset form
      setFormData({
        schoolDistrict: '',
        firstName: '',
        lastName: '',
        streetAddress: '',
        city: '',
        state: '',
        zipCode: '',
        email: '',
        phone: '',
        totalAttendees: 1,
        additionalAttendees: []
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle specific error types
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      // Re-throw with the original error message or a generic one
      throw new Error(error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="pt-16">
      {/* Unavailable Popup */}
      {showUnavailablePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
                <h2 className="text-xl font-bold text-gray-900">Registration Unavailable</h2>
              </div>
              <button
                onClick={() => setShowUnavailablePopup(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Tech Conference registration is not available at this time. Please check back later or contact us for more information.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowUnavailablePopup(false)}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">Tech Conference Registration</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Register for the {conferenceSettings?.name || 'TAPT Tech Conference'} and join transportation professionals from across Tennessee.</p>
          </div>
        </div>
      </section>

      {/* Conference Info */}
      {!isRegistrationClosed && conferenceSettings?.is_active && (
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-8 md:p-10">
                <h2 className="text-3xl font-bold text-secondary mb-6">{conferenceSettings?.name || 'TAPT Tech Conference'}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Event Details</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <Calendar className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Date:</span>
                          <p>{new Date(conferenceSettings?.start_date || '').toLocaleDateString()} - {new Date(conferenceSettings?.end_date || '').toLocaleDateString()}</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <MapPin className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Location:</span>
                          <p>{conferenceSettings?.venue}</p>
                          <p>{conferenceSettings?.location}</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Registration Information</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <DollarSign className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Registration Fee:</span>
                          <p>${registrationFee.toFixed(2)} per attendee</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <Mail className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Payment Instructions:</span>
                          <p>{conferenceSettings?.payment_instructions}</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                {conferenceSettings?.description && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-md">
                    <p className="text-gray-700">{conferenceSettings.description}</p>
                  </div>
                )}

                {/* Registration Deadline Notice */}
                {conferenceSettings?.registration_end_date && (
                  <div className={`mt-6 p-4 rounded-md ${
                    isRegistrationClosed 
                      ? 'bg-red-50 border border-red-200' 
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <div className="flex items-start">
                      <AlertCircle className={`h-5 w-5 ${
                        isRegistrationClosed ? 'text-red-400' : 'text-yellow-400'
                      }`} />
                      <div className="ml-3">
                        <h3 className={`text-sm font-medium ${
                          isRegistrationClosed ? 'text-red-800' : 'text-yellow-800'
                        }`}>
                          {isRegistrationClosed 
                            ? 'Registration is closed'
                            : 'Registration deadline approaching'
                          }
                        </h3>
                        <p className={`mt-1 text-sm ${
                          isRegistrationClosed ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          {isRegistrationClosed
                            ? `Registration closed on ${new Date(conferenceSettings.registration_end_date).toLocaleDateString()}`
                            : `Registration closes on ${new Date(conferenceSettings.registration_end_date).toLocaleDateString()}`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Registration Form */}
      {isRegistrationClosed || !conferenceSettings?.is_active ? (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Calendar className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-secondary mb-4">Registration has now closed</h2>
              <p className="text-gray-600">
                Thank you for your interest in the TAPT Tech Conference. Registration is currently closed. 
                Please check back later for future events.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* ✅ FIXED: Only show success messages - SecureForm handles errors */}
            {formStatus.success && formStatus.message && (
              <div className="mb-8 p-4 rounded-md bg-green-50 border border-green-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">{formStatus.message}</p>
                  </div>
                </div>
              </div>
            )}

            <SecureForm onSubmit={handleSecureSubmit} className="bg-white shadow-lg rounded-lg p-8">
              {/* Organization Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Organization Information</h2>
                <div>
                  <label htmlFor="schoolDistrict" className="block text-sm font-medium text-gray-700 mb-1">
                    School District or Organization <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="schoolDistrict"
                      name="schoolDistrict"
                      value={formData.schoolDistrict}
                      onChange={handleChange}
                      required
                      className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Primary Contact</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Address</h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="streetAddress" className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="streetAddress"
                        name="streetAddress"
                        value={formData.streetAddress}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                        State <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      >
                        <option value="">Select State</option>
                        <option value="TN">Tennessee</option>
                        {/* Add other states as needed */}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="zipCode"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendees */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Registration Details</h2>
                <div>
                  <label htmlFor="totalAttendees" className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Attendees <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Users className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      id="totalAttendees"
                      name="totalAttendees"
                      value={formData.totalAttendees}
                      onChange={handleChange}
                      required
                      min="1"
                      className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">Registration fee: ${registrationFee.toFixed(2)} per attendee</p>
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Amount:</span>
                      <span className="text-xl font-bold text-primary">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Attendees */}
              {formData.totalAttendees > 1 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-secondary mb-6">Additional Attendees</h2>
                  {formData.additionalAttendees.map((attendee, index) => (
                    <div key={index} className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-lg font-medium text-gray-700 mb-4">Attendee {index + 2}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={attendee.firstName}
                            onChange={(e) => handleAttendeeChange(index, 'firstName', e.target.value)}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={attendee.lastName}
                            onChange={(e) => handleAttendeeChange(index, 'lastName', e.target.value)}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={attendee.email}
                            onChange={(e) => handleAttendeeChange(index, 'email', e.target.value)}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </SecureForm>
          </div>
        </section>
      )}
    </div>
  );
};

export default TechConferenceRegistration;
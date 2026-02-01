import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, User, Award, CheckCircle, AlertCircle, Briefcase, Building2 } from 'lucide-react';
import { SecureForm } from '../components/forms/SecureForm';

interface ScholarshipSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  application_deadline: string;
  description: string;
  eligibility_criteria: string;
  instructions: string;
  is_active: boolean;
}

// Tennessee regions
const TENNESSEE_REGIONS = ['East', 'Middle', 'West'] as const;
type Region = typeof TENNESSEE_REGIONS[number];

const StudentScholarshipApplication: React.FC = () => {
  // Current year for graduation validation
  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    // Nominator Information (Required)
    nominatorFirstName: '',
    nominatorLastName: '',
    nominatorTitle: '',
    nominatorEmail: '',
    nominatorPhone: '',
    nominatorDistrict: '',
    // Region (Required)
    region: '' as Region | '',
    // Student Information
    studentFirstName: '',
    studentLastName: '',
    studentHighSchool: '',
    studentGraduationYear: currentYear.toString(),
    studentEmail: '', // Optional
    studentPhone: '', // Optional
    // Student Address
    streetAddress: '',
    streetAddress2: '',
    city: '',
    state: 'TN', // Default to Tennessee
    zipCode: '',
    // Essay
    essay: ''
  });


  const [formStatus, setFormStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  const [scholarshipSettings, setScholarshipSettings] = useState<ScholarshipSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplicationClosed, setIsApplicationClosed] = useState(false);
  const [wordCounts, setWordCounts] = useState({
    essay: 0
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchScholarshipSettings();
  }, []);

  useEffect(() => {
    // Count words in essay
    const essayWords = formData.essay.trim() ? formData.essay.trim().split(/\s+/).length : 0;
    
    setWordCounts({
      essay: essayWords
    });
  }, [formData.essay]);

  const fetchScholarshipSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('student_scholarship_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching scholarship settings:', error);
        setError('Failed to load scholarship settings. Please try again later.');
        return;
      }

      if (!data) {
        setError('No active scholarship application is available at this time.');
        setIsApplicationClosed(true);
        return;
      }

      setScholarshipSettings(data);

      // Check if application deadline has passed
      if (data.application_deadline) {
        const deadlineStr = data.application_deadline.includes('T') ? data.application_deadline.split('T')[0] : data.application_deadline;
        const [year, month, day] = deadlineStr.split('-').map(Number);
        const deadlineDate = new Date(year, month - 1, day);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        if (now > deadlineDate) {
          setIsApplicationClosed(true);
          setError(`Application deadline was ${deadlineDate.toLocaleDateString()}`);
        } else {
          setIsApplicationClosed(false);
          setError(null);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'radio') {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // SecureForm passes: (formData, isVerified, turnstileToken)
  const handleSecureSubmit = async (_formData: any, _isVerified: boolean, turnstileToken?: string) => {
    if (!turnstileToken) {
      throw new Error('Security verification required. Please complete the captcha.');
    }

    if (!scholarshipSettings?.is_active) {
      throw new Error('Scholarship nominations are not currently available.');
    }

    if (isApplicationClosed) {
      throw new Error('Nomination deadline has passed.');
    }

    // Validate essay word count
    if (wordCounts.essay < 300 || wordCounts.essay > 500) {
      throw new Error('Your nomination essay must be between 300-500 words.');
    }

    // Validate graduation year is current year
    if (formData.studentGraduationYear !== currentYear.toString()) {
      throw new Error(`Student must be graduating in ${currentYear} to be eligible.`);
    }

    try {
      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration error. Please contact support.');
      }

      // Prepare the request payload (new nomination-based structure)
      const payload = {
        nominator: {
          firstName: formData.nominatorFirstName.trim(),
          lastName: formData.nominatorLastName.trim(),
          title: formData.nominatorTitle.trim(),
          email: formData.nominatorEmail.trim().toLowerCase(),
          phone: formData.nominatorPhone.trim(),
          district: formData.nominatorDistrict.trim()
        },
        region: formData.region,
        student: {
          firstName: formData.studentFirstName.trim(),
          lastName: formData.studentLastName.trim(),
          highSchool: formData.studentHighSchool.trim(),
          graduationYear: formData.studentGraduationYear,
          email: formData.studentEmail.trim() || undefined,
          phone: formData.studentPhone.trim() || undefined,
          homeAddress: {
            addr_line1: formData.streetAddress.trim(),
            addr_line2: formData.streetAddress2.trim() || undefined,
            city: formData.city.trim(),
            state: formData.state.trim(),
            postal: formData.zipCode.trim()
          }
        },
        essay: formData.essay.trim(),
        turnstileToken
      };

      // Make the request to the Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-student-scholarship-application`, {
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

      if (!response.ok) {
        throw new Error(result?.error || `Server error (${response.status}). Please try again.`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Nomination failed. Please try again.');
      }

      // ✅ Only show success message via formStatus
      setFormStatus({
        success: true,
        message: 'Nomination submitted successfully! The nominator will receive a confirmation email shortly.'
      });
      
      // Reset form
      setFormData({
        nominatorFirstName: '',
        nominatorLastName: '',
        nominatorTitle: '',
        nominatorEmail: '',
        nominatorPhone: '',
        nominatorDistrict: '',
        region: '',
        studentFirstName: '',
        studentLastName: '',
        studentHighSchool: '',
        studentGraduationYear: currentYear.toString(),
        studentEmail: '',
        studentPhone: '',
        streetAddress: '',
        streetAddress2: '',
        city: '',
        state: 'TN',
        zipCode: '',
        essay: ''
      });
    } catch (error: any) {
      console.error('Nomination error:', error);
      
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
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">{scholarshipSettings?.name || 'TAPT Student Scholarship Nomination'}</h1>
            <p className="text-xl text-gray-200 mb-4 fade-in">Nomination Form for Transportation Directors</p>
            <p className="text-lg text-gray-300 fade-in">Nomination Deadline: {scholarshipSettings?.application_deadline ? (() => {
              const deadlineStr = scholarshipSettings.application_deadline.includes('T') ? scholarshipSettings.application_deadline.split('T')[0] : scholarshipSettings.application_deadline;
              const [y, m, d] = deadlineStr.split('-').map(Number);
              const date = new Date(y, m - 1, d);
              return date.toLocaleDateString();
            })() : 'TBD'}</p>
          </div>
        </div>
      </section>

      {/* Scholarship Info */}
      {!isApplicationClosed && scholarshipSettings?.is_active && (
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Nomination Deadline - Prominent Display */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg p-6 mb-8">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-yellow-600 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-yellow-900 mb-1">Nomination Deadline</h3>
                  <p className="text-2xl font-bold text-yellow-700">
                    {scholarshipSettings?.application_deadline ? (() => {
                      const deadlineStr = scholarshipSettings.application_deadline.includes('T') ? scholarshipSettings.application_deadline.split('T')[0] : scholarshipSettings.application_deadline;
                      const [y, m, d] = deadlineStr.split('-').map(Number);
                      const date = new Date(y, m - 1, d);
                      return date.toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      });
                    })() : 'TBD'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-8 md:p-10">
                <h2 className="text-3xl font-bold text-secondary mb-6">{scholarshipSettings?.name || 'TAPT Student Scholarship Nomination'}</h2>
                
                <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">Who Can Submit Nominations?</h3>
                  <p className="text-blue-700">
                    This form is for <strong>Transportation Directors</strong> to nominate deserving students from their school district.
                    Students must be graduating in {currentYear} to be eligible.
                  </p>
                </div>
                
                {scholarshipSettings?.description && (
                  <div className="mb-8">
                    <p className="text-gray-700">{scholarshipSettings.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {scholarshipSettings?.eligibility_criteria && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-blue-800 mb-2">Eligibility Criteria</h3>
                      <p className="text-blue-700">{scholarshipSettings.eligibility_criteria}</p>
                    </div>
                  )}
                  
                  {scholarshipSettings?.instructions && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-green-800 mb-2">Nomination Instructions</h3>
                      <p className="text-green-700">{scholarshipSettings.instructions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Nomination Form */}
      {isApplicationClosed || !scholarshipSettings?.is_active ? (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Award className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-secondary mb-4">Scholarship Nominations are Currently Closed</h2>
              <p className="text-gray-600">
                Thank you for your interest in the TAPT Student Scholarship. The nomination period is currently closed. 
                Please check back later for future scholarship opportunities.
              </p>
              {error && (
                <p className="mt-4 text-red-600">{error}</p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {formStatus.message && (
              <div className={`mb-8 p-4 rounded-md ${formStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {formStatus.success ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm ${formStatus.success ? 'text-green-800' : 'text-red-800'}`}>
                      {formStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <SecureForm onSubmit={handleSecureSubmit} className="bg-white shadow-lg rounded-lg p-8">
              {/* Section I: Nominator Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-2">I. Nominator Information</h2>
                <p className="text-sm text-gray-600 mb-6">Transportation Director submitting this nomination</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="nominatorFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="nominatorFirstName"
                        name="nominatorFirstName"
                        value={formData.nominatorFirstName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="nominatorLastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="nominatorLastName"
                        name="nominatorLastName"
                        value={formData.nominatorLastName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="nominatorTitle" className="block text-sm font-medium text-gray-700 mb-1">
                      Title/Position <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="nominatorTitle"
                        name="nominatorTitle"
                        value={formData.nominatorTitle}
                        onChange={handleChange}
                        required
                        placeholder="e.g., Director of Transportation"
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="nominatorDistrict" className="block text-sm font-medium text-gray-700 mb-1">
                      School District <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="nominatorDistrict"
                        name="nominatorDistrict"
                        value={formData.nominatorDistrict}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="nominatorEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="nominatorEmail"
                        name="nominatorEmail"
                        value={formData.nominatorEmail}
                        onChange={handleChange}
                        required
                        placeholder="your.email@district.org"
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Confirmation will be sent to this address</p>
                  </div>

                  <div>
                    <label htmlFor="nominatorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="nominatorPhone"
                        name="nominatorPhone"
                        value={formData.nominatorPhone}
                        onChange={handleChange}
                        required
                        placeholder="(123) 456-7890"
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Region Selection */}
                <div className="mb-6">
                  <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
                    Tennessee Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    required
                    className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                  >
                    <option value="">Select Region</option>
                    {TENNESSEE_REGIONS.map(region => (
                      <option key={region} value={region}>{region} Tennessee</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section II: Student Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-2">II. Student Information</h2>
                <p className="text-sm text-gray-600 mb-6">Student being nominated for the scholarship</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="studentFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="studentFirstName"
                        name="studentFirstName"
                        value={formData.studentFirstName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="studentLastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="studentLastName"
                        name="studentLastName"
                        value={formData.studentLastName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="studentHighSchool" className="block text-sm font-medium text-gray-700 mb-1">
                      High School <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="studentHighSchool"
                      name="studentHighSchool"
                      value={formData.studentHighSchool}
                      onChange={handleChange}
                      required
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>

                  <div>
                    <label htmlFor="studentGraduationYear" className="block text-sm font-medium text-gray-700 mb-1">
                      Graduation Year <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="studentGraduationYear"
                      name="studentGraduationYear"
                      value={formData.studentGraduationYear}
                      onChange={handleChange}
                      required
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    >
                      <option value={currentYear.toString()}>{currentYear}</option>
                    </select>
                    <p className="mt-1 text-sm text-gray-500">Student must be graduating in {currentYear} to be eligible</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Student Email <span className="text-gray-400">(Optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="studentEmail"
                        name="studentEmail"
                        value={formData.studentEmail}
                        onChange={handleChange}
                        placeholder="student@email.com"
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="studentPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Student Phone <span className="text-gray-400">(Optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="studentPhone"
                        name="studentPhone"
                        value={formData.studentPhone}
                        onChange={handleChange}
                        placeholder="(123) 456-7890"
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Student Address */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student Home Address <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-4">
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
                        placeholder="Street Address"
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                    <input
                      type="text"
                      id="streetAddress2"
                      name="streetAddress2"
                      value={formData.streetAddress2}
                      onChange={handleChange}
                      placeholder="Apartment, suite, unit, etc. (optional)"
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <input
                          type="text"
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          required
                          placeholder="City"
                          className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleChange}
                          required
                          placeholder="State"
                          className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          id="zipCode"
                          name="zipCode"
                          value={formData.zipCode}
                          onChange={handleChange}
                          required
                          placeholder="ZIP Code"
                          className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section III: Nomination Essay */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-2">III. Nomination Essay</h2>
                <p className="text-sm text-gray-600 mb-6">Please provide a detailed recommendation for this student</p>
                
                <div className="bg-yellow-50 p-4 rounded-md mb-6">
                  <p className="text-sm text-gray-700">
                    Your nomination essay should be <strong>300-500 words</strong>. Please describe why you are nominating this student, 
                    including their character, achievements, involvement in transportation (if any), community contributions, and why 
                    they would be a worthy recipient of the TAPT scholarship.
                  </p>
                </div>

                <div className="mb-6">
                  <label htmlFor="essay" className="block text-sm font-medium text-gray-700 mb-1">
                    Nomination Essay <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="essay"
                    name="essay"
                    value={formData.essay}
                    onChange={handleChange}
                    rows={10}
                    required
                    placeholder="Explain why this student deserves the TAPT scholarship..."
                    className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                  />
                  <p className={`mt-1 text-sm ${wordCounts.essay < 300 || wordCounts.essay > 500 ? 'text-red-500' : 'text-gray-500'}`}>
                    {wordCounts.essay}/500 words {wordCounts.essay < 300 ? '(minimum 300 words required)' : wordCounts.essay > 500 ? '(maximum 500 words exceeded)' : ''}
                  </p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mb-8">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-700">
                    By submitting this nomination, you certify that all information provided is accurate and that you are authorized 
                    to nominate this student for the TAPT scholarship. TAPT is committed to equal opportunity and does not discriminate 
                    on the basis of race, color, religion, gender, age, national origin, disability, marital status, or any other protected class.
                  </p>
                </div>
              </div>

            </SecureForm>
          </div>
        </section>
      )}
    </div>
  );
};

export default StudentScholarshipApplication;
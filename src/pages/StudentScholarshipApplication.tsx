import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, Calendar, User, Book, Award, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { handleError } from '../lib/errors';
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

const StudentScholarshipApplication: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthMonth: '',
    birthDay: '',
    birthYear: '',
    gender: '',
    isUsCitizen: '',
    applicationStatus: '',
    isFirstGen: '',
    majorArea: '',
    careerObjective: '',
    highSchool: '',
    schoolDistrict: '',
    graduationYear: '',
    gpa: '',
    activities: '',
    actYear: '',
    actScore: '',
    essay: '',
    streetAddress: '',
    streetAddress2: '',
    city: '',
    state: '',
    zipCode: '',
    mobilePhone: '',
    email: '',
    signature: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  const [scholarshipSettings, setScholarshipSettings] = useState<ScholarshipSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplicationClosed, setIsApplicationClosed] = useState(false);
  const [wordCounts, setWordCounts] = useState({
    careerObjective: 0,
    essay: 0
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchScholarshipSettings();
  }, []);

  useEffect(() => {
    // Count words in career objective
    const careerWords = formData.careerObjective.trim() ? formData.careerObjective.trim().split(/\s+/).length : 0;
    
    // Count words in essay
    const essayWords = formData.essay.trim() ? formData.essay.trim().split(/\s+/).length : 0;
    
    setWordCounts({
      careerObjective: careerWords,
      essay: essayWords
    });
  }, [formData.careerObjective, formData.essay]);

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
        const deadlineDate = new Date(data.application_deadline);
        const now = new Date();
        
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

  const handleSecureSubmit = async (turnstileToken: string) => {
    if (!scholarshipSettings?.is_active) {
      throw new Error('Scholarship application is not currently available.');
    }

    if (isApplicationClosed) {
      throw new Error('Application deadline has passed.');
    }

    // Validate essay word count
    if (wordCounts.essay < 300 || wordCounts.essay > 500) {
      throw new Error('Your essay must be between 300-500 words.');
    }

    setIsSubmitting(true);

    try {
      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }

      // Format birthdate
      const birthdate = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;

      // Prepare the request payload
      const payload = {
        fullName: {
          first: formData.firstName,
          last: formData.lastName
        },
        birthdate,
        gender: formData.gender || null,
        isUsCitizen: formData.isUsCitizen === 'Yes',
        applicationStatus: formData.applicationStatus,
        isFirstGen: formData.isFirstGen === 'Yes, I am the first among my parents or grandparents to attend college.',
        majorArea: formData.majorArea,
        careerObjective: formData.careerObjective,
        highSchool: formData.highSchool,
        schoolDistrict: formData.schoolDistrict,
        graduationYear: formData.graduationYear,
        gpa: formData.gpa,
        activities: formData.activities,
        actYear: formData.actYear,
        actScore: formData.actScore,
        essay: formData.essay,
        homeAddress: {
          addr_line1: formData.streetAddress,
          addr_line2: formData.streetAddress2,
          city: formData.city,
          state: formData.state,
          postal: formData.zipCode
        },
        mobilePhone: formData.mobilePhone,
        email: formData.email,
        signature: formData.signature,
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
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit application');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit application');
      }

      // ✅ Only show success message via formStatus
      setFormStatus({
        success: true,
        message: 'Application submitted successfully! You will receive a confirmation email shortly.'
      });
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        birthMonth: '',
        birthDay: '',
        birthYear: '',
        gender: '',
        isUsCitizen: '',
        applicationStatus: '',
        isFirstGen: '',
        majorArea: '',
        careerObjective: '',
        highSchool: '',
        schoolDistrict: '',
        graduationYear: '',
        gpa: '',
        activities: '',
        actYear: '',
        actScore: '',
        essay: '',
        streetAddress: '',
        streetAddress2: '',
        city: '',
        state: '',
        zipCode: '',
        mobilePhone: '',
        email: '',
        signature: ''
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      const { message } = handleError(error);
      
      // ✅ Re-throw the error so SecureForm can display it
      throw new Error(`Error submitting application: ${message}`);
    } finally {
      setIsSubmitting(false);
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
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">{scholarshipSettings?.name || 'TAPT Scholarship Application'}</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Application Deadline: {scholarshipSettings?.application_deadline ? new Date(scholarshipSettings.application_deadline).toLocaleDateString() : 'May 15, 2025'}</p>
          </div>
        </div>
      </section>

      {/* Scholarship Info */}
      {!isApplicationClosed && scholarshipSettings?.is_active && (
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-8 md:p-10">
                <h2 className="text-3xl font-bold text-secondary mb-6">{scholarshipSettings?.name || 'TAPT Scholarship Application'}</h2>
                
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
                      <h3 className="text-lg font-semibold text-green-800 mb-2">Application Instructions</h3>
                      <p className="text-green-700">{scholarshipSettings.instructions}</p>
                    </div>
                  )}
                </div>

                {/* Application Deadline Notice */}
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Application deadline approaching
                      </h3>
                      <p className="mt-1 text-sm text-yellow-700">
                        Applications must be submitted by {new Date(scholarshipSettings?.application_deadline || '').toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Application Form */}
      {isApplicationClosed || !scholarshipSettings?.is_active ? (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Award className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-secondary mb-4">Scholarship Application has now closed</h2>
              <p className="text-gray-600">
                Thank you for your interest in the TAPT Scholarship. The application period is currently closed. 
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
              {/* Personal Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">I. Personal Data</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Birthdate <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <select
                        id="birthMonth"
                        name="birthMonth"
                        value={formData.birthMonth}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      >
                        <option value="">Month</option>
                        <option value="01">January</option>
                        <option value="02">February</option>
                        <option value="03">March</option>
                        <option value="04">April</option>
                        <option value="05">May</option>
                        <option value="06">June</option>
                        <option value="07">July</option>
                        <option value="08">August</option>
                        <option value="09">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                    </div>
                    <div>
                      <select
                        id="birthDay"
                        name="birthDay"
                        value={formData.birthDay}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day.toString().padStart(2, '0')}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        id="birthYear"
                        name="birthYear"
                        value={formData.birthYear}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      >
                        <option value="">Year</option>
                        {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - 29 + i).map(year => (
                          <option key={year} value={year.toString()}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender (Optional)
                    </label>
                    <div className="mt-2 space-x-6">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="gender"
                          value="Male"
                          checked={formData.gender === 'Male'}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                        />
                        <span className="ml-2 text-gray-700">Male</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="gender"
                          value="Female"
                          checked={formData.gender === 'Female'}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                        />
                        <span className="ml-2 text-gray-700">Female</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Are you a US citizen? (Optional)
                    </label>
                    <div className="mt-2 space-x-6">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="isUsCitizen"
                          value="Yes"
                          checked={formData.isUsCitizen === 'Yes'}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                        />
                        <span className="ml-2 text-gray-700">Yes</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="isUsCitizen"
                          value="No"
                          checked={formData.isUsCitizen === 'No'}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                        />
                        <span className="ml-2 text-gray-700">No</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Please check your status at the time of application <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="applicationStatus"
                        value="I will graduate in May 2025"
                        checked={formData.applicationStatus === 'I will graduate in May 2025'}
                        onChange={handleChange}
                        required
                        className="h-4 w-4 mt-1 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-gray-700">I will graduate in May 2025</span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="applicationStatus"
                        value="I will be an incoming freshman graduating high school prior to 2025"
                        checked={formData.applicationStatus === 'I will be an incoming freshman graduating high school prior to 2025'}
                        onChange={handleChange}
                        required
                        className="h-4 w-4 mt-1 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-gray-700">I will be an incoming freshman graduating high school prior to 2025</span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="applicationStatus"
                        value="I have attended college but have less than 32 college credit hours"
                        checked={formData.applicationStatus === 'I have attended college but have less than 32 college credit hours'}
                        onChange={handleChange}
                        required
                        className="h-4 w-4 mt-1 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-gray-700">I have attended college but have less than 32 college credit hours</span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="applicationStatus"
                        value="I have attended college but have at least 32 or more college credit hours"
                        checked={formData.applicationStatus === 'I have attended college but have at least 32 or more college credit hours'}
                        onChange={handleChange}
                        required
                        className="h-4 w-4 mt-1 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-gray-700">I have attended college but have at least 32 or more college credit hours</span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="applicationStatus"
                        value="I am a GED graduate with no college credit hours"
                        checked={formData.applicationStatus === 'I am a GED graduate with no college credit hours'}
                        onChange={handleChange}
                        required
                        className="h-4 w-4 mt-1 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-gray-700">I am a GED graduate with no college credit hours</span>
                    </label>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Are you a first generation college student?
                  </label>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="isFirstGen"
                        value="Yes, I am the first among my parents or grandparents to attend college."
                        checked={formData.isFirstGen === 'Yes, I am the first among my parents or grandparents to attend college.'}
                        onChange={handleChange}
                        className="h-4 w-4 mt-1 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-gray-700">Yes, I am the first among my parents or grandparents to attend college.</span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="isFirstGen"
                        value="No, either my parents or grandparents have attended college."
                        checked={formData.isFirstGen === 'No, either my parents or grandparents have attended college.'}
                        onChange={handleChange}
                        className="h-4 w-4 mt-1 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-gray-700">No, either my parents or grandparents have attended college.</span>
                    </label>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="majorArea" className="block text-sm font-medium text-gray-700 mb-1">
                    Major Area of Study
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Book className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      id="majorArea"
                      name="majorArea"
                      value={formData.majorArea}
                      onChange={handleChange}
                      className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    >
                      <option value="">Please Select</option>
                      <option value="Accounting (AS Degree)">Accounting (AS Degree)</option>
                      <option value="Aerospace Technology (AAS Degree)">Aerospace Technology (AAS Degree)</option>
                      <option value="Agricultural Science (AS Degree)">Agricultural Science (AS Degree)</option>
                      <option value="Air Conditioning/Refrigeration (AAS Degree)">Air Conditioning/Refrigeration (AAS Degree)</option>
                      <option value="Applied Technology (AAS Degree)">Applied Technology (AAS Degree)</option>
                      <option value="Art (AS Degree)">Art (AS Degree)</option>
                      <option value="Automation/Robotics (AAS Degree)">Automation/Robotics (AAS Degree)</option>
                      <option value="Biological Science (AS Degree)">Biological Science (AS Degree)</option>
                      <option value="Business (AS Degree)">Business (AS Degree)</option>
                      <option value="Business Administration (AAS Degree)">Business Administration (AAS Degree)</option>
                      <option value="Chemistry (AS Degree)">Chemistry (AS Degree)</option>
                      <option value="Child Development (AAS Degree)">Child Development (AAS Degree)</option>
                      <option value="Child Development (AS Degree)">Child Development (AS Degree)</option>
                      <option value="Clinical Laboratory Technology (AAS Degree)">Clinical Laboratory Technology (AAS Degree)</option>
                      <option value="Computer Graphics (AAS Degree)">Computer Graphics (AAS Degree)</option>
                      <option value="Computer Information Systems (AAS Degree)">Computer Information Systems (AAS Degree)</option>
                      <option value="Computer Information Systems (AS Degree)">Computer Information Systems (AS Degree)</option>
                      <option value="Criminal Justice (AS Degree)">Criminal Justice (AS Degree)</option>
                      <option value="Dental Assisting (AAS Degree)">Dental Assisting (AAS Degree)</option>
                      <option value="Design Drafting Technology (AAS Degree)">Design Drafting Technology (AAS Degree)</option>
                      <option value="Electrical Technology (AAS Degree)">Electrical Technology (AAS Degree)</option>
                      <option value="Elementary Teacher Education (AS Degree)">Elementary Teacher Education (AS Degree)</option>
                      <option value="Emergency Medical Services (AAS Degree)">Emergency Medical Services (AAS Degree)</option>
                      <option value="English (AA Degree)">English (AA Degree)</option>
                      <option value="Fire Services Management (AS Degree)">Fire Services Management (AS Degree)</option>
                      <option value="General Education (AS Degree)">General Education (AS Degree)</option>
                      <option value="Health & Physical Education (AS Degree)">Health & Physical Education (AS Degree)</option>
                      <option value="Industrial Maintenance (AAS Degree)">Industrial Maintenance (AAS Degree)</option>
                      <option value="Law/Pre-Law (AA Degree)">Law/Pre-Law (AA Degree)</option>
                      <option value="Machine Tool Technology (AAS Degree)">Machine Tool Technology (AAS Degree)</option>
                      <option value="Mathematics (AS Degree)">Mathematics (AS Degree)</option>
                      <option value="Medicine/Pre-Medicine or Pre-Dentistry (AS Degree)">Medicine/Pre-Medicine or Pre-Dentistry (AS Degree)</option>
                      <option value="Medicine/Pre-Veterinary Medicine (AS Degree)">Medicine/Pre-Veterinary Medicine (AS Degree)</option>
                      <option value="Missile and Munitions Technology (AAS Degree)">Missile and Munitions Technology (AAS Degree)</option>
                      <option value="Music Education (AS Degree)">Music Education (AS Degree)</option>
                      <option value="Music Industry Communications (AAS Degree)">Music Industry Communications (AAS Degree)</option>
                      <option value="Nursing/ADN (AAS Degree)">Nursing/ADN (AAS Degree)</option>
                      <option value="Nursing/Pre-Nursing (AS Degree)">Nursing/Pre-Nursing (AS Degree)</option>
                      <option value="Paramedic (AAS Degree)">Paramedic (AAS Degree)</option>
                      <option value="Pharmacy/Pre-Pharmacy (AS Degree)">Pharmacy/Pre-Pharmacy (AS Degree)</option>
                      <option value="Photography and Film Communications (AS Degree)">Photography and Film Communications (AS Degree)</option>
                      <option value="Physical Therapist Assistant (AAS Degree)">Physical Therapist Assistant (AAS Degree)</option>
                      <option value="Pre-Engineering (AS Degree)">Pre-Engineering (AS Degree)</option>
                      <option value="Process Technology (AAS Degree)">Process Technology (AAS Degree)</option>
                      <option value="Renewable Energy">Renewable Energy</option>
                      <option value="Secondary Teacher Education (AS Degree)">Secondary Teacher Education (AS Degree)</option>
                      <option value="Theater Arts (AS Degree)">Theater Arts (AS Degree)</option>
                      <option value="Undecided">Undecided</option>
                    </select>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="careerObjective" className="block text-sm font-medium text-gray-700 mb-1">
                    What is your career objective?
                  </label>
                  <textarea
                    id="careerObjective"
                    name="careerObjective"
                    value={formData.careerObjective}
                    onChange={handleChange}
                    rows={4}
                    className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {wordCounts.careerObjective}/300 words
                  </p>
                </div>
              </div>

              {/* High School Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">II. High School Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="highSchool" className="block text-sm font-medium text-gray-700 mb-1">
                      High School Attended <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="highSchool"
                      name="highSchool"
                      value={formData.highSchool}
                      onChange={handleChange}
                      required
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>

                  <div>
                    <label htmlFor="schoolDistrict" className="block text-sm font-medium text-gray-700 mb-1">
                      Name of School District <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="schoolDistrict"
                      name="schoolDistrict"
                      value={formData.schoolDistrict}
                      onChange={handleChange}
                      required
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="graduationYear" className="block text-sm font-medium text-gray-700 mb-1">
                      Year of High School Graduation or GED <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="graduationYear"
                      name="graduationYear"
                      value={formData.graduationYear}
                      onChange={handleChange}
                      required
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>

                  <div>
                    <label htmlFor="gpa" className="block text-sm font-medium text-gray-700 mb-1">
                      Most recent cumulative GPA
                    </label>
                    <input
                      type="text"
                      id="gpa"
                      name="gpa"
                      value={formData.gpa}
                      onChange={handleChange}
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="activities" className="block text-sm font-medium text-gray-700 mb-1">
                    High School activities, community activities, volunteer work, honors, offices held
                  </label>
                  <textarea
                    id="activities"
                    name="activities"
                    value={formData.activities}
                    onChange={handleChange}
                    rows={4}
                    className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                  />
                </div>
              </div>

              {/* ACT Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">III. ACT Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="actYear" className="block text-sm font-medium text-gray-700 mb-1">
                      Year you took the ACT
                    </label>
                    <input
                      type="text"
                      id="actYear"
                      name="actYear"
                      value={formData.actYear}
                      onChange={handleChange}
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>

                  <div>
                    <label htmlFor="actScore" className="block text-sm font-medium text-gray-700 mb-1">
                      ACT composite (overall) score
                    </label>
                    <input
                      type="text"
                      id="actScore"
                      name="actScore"
                      value={formData.actScore}
                      onChange={handleChange}
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-md mb-6">
                  <p className="text-sm text-gray-700">
                    ACT scores are not required for scholarship eligibility. However, providing an ACT score can increase the likelihood of your selection as compared to other candidates.
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    All scholarship applicants reporting an ACT score will be asked to provide official verification.
                  </p>
                </div>
              </div>

              {/* Essay */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">IV. Essay</h2>
                
                <div className="bg-yellow-50 p-4 rounded-md mb-6">
                  <p className="text-sm text-gray-700">
                    Your essay should be 300-500 words. You should address in your essay: your college goals and choice of major, 
                    what you intend to do with your education, and why a scholarship is important to you. Include any academic and 
                    non-academic accomplishments, personal characteristics, or experiences that make you uniquely worthy of scholarship consideration.
                  </p>
                </div>

                <div className="mb-6">
                  <label htmlFor="essay" className="block text-sm font-medium text-gray-700 mb-1">
                    Essay <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="essay"
                    name="essay"
                    value={formData.essay}
                    onChange={handleChange}
                    rows={8}
                    required
                    className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                  />
                  <p className={`mt-1 text-sm ${wordCounts.essay < 300 || wordCounts.essay > 500 ? 'text-red-500' : 'text-gray-500'}`}>
                    {wordCounts.essay}/500 words {wordCounts.essay < 300 ? '(minimum 300 words required)' : wordCounts.essay > 500 ? '(maximum 500 words exceeded)' : ''}
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">V. Contact Information</h2>
                
                <div className="mb-6">
                  <label htmlFor="mobilePhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="mobilePhone"
                      name="mobilePhone"
                      value={formData.mobilePhone}
                      onChange={handleChange}
                      required
                      placeholder="(123) 456-7890"
                      className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                </div>

                <div className="mb-6">
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
                      placeholder="your.email@example.com"
                      className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Please indicate correct email as your confirmation for scholarship eligibility will be sent to this address.
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Address <span className="text-red-500">*</span>
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
                      placeholder="Apartment, suite, unit, building, floor, etc."
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

              {/* Signature */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">VI. Applicant's E-Signature</h2>
                
                <div className="bg-gray-50 p-4 rounded-md mb-6">
                  <p className="text-sm text-gray-700">
                    By signing below, you are certifying that all information is correct and that you are the person completing this application. 
                    When you press the submit button, you will receive an email confirmation that your application was received. 
                    Please print for your records and retain as verification of your application.
                  </p>
                </div>

                <div className="mb-6">
                  <label htmlFor="signature" className="block text-sm font-medium text-gray-700 mb-1">
                    Signature (Type your full name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="signature"
                    name="signature"
                    value={formData.signature}
                    onChange={handleChange}
                    required
                    className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                  />
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mb-8">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-700">
                    TAPT is committed to equal opportunity in employment and education, and does not discriminate in any program or activity 
                    on the basis of race, color, religion, gender, age, national origin, disability, marital status, or any other protected class.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting || wordCounts.essay < 300 || wordCounts.essay > 500}
                  className="w-full inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </SecureForm>
          </div>
        </section>
      )}
    </div>
  );
};

export default StudentScholarshipApplication;
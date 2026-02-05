import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Mail, Phone, Building, Clock, Award, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { SecureForm } from '../components/forms/SecureForm';
import { SuccessModal } from '../components/ui/SuccessModal';

interface HallOfFameSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  nomination_instructions: string;
  eligibility_criteria: string;
  is_active: boolean;
  // Dynamic year configuration
  conference_year_1: number;
  conference_year_2: number;
  conference_year_3: number;
  award_year: number;
}

// Grand Divisions - one winner selected per division
const GRAND_DIVISIONS = [
  { value: '', label: 'Select Grand Division' },
  { value: 'East Tennessee', label: 'East Tennessee' },
  { value: 'Middle Tennessee', label: 'Middle Tennessee' },
  { value: 'West Tennessee', label: 'West Tennessee' }
];

// Valid nominator roles per 2026 guidelines
const NOMINATOR_ROLES = [
  { value: '', label: 'Select Your Role' },
  { value: 'Transportation Supervisor', label: 'Transportation Supervisor (Listed with TN DOE)' },
  { value: 'Director of Schools', label: 'Director of Schools' }
];

export const HallOfFameNomination: React.FC = () => {
  const [formData, setFormData] = useState({
    // Nominee Information
    nomineeFirstName: '',
    nomineeLastName: '',
    district: '',
    grandDivision: '',
    yearsOfService: '',
    
    // Nominator Information
    nominatorFirstName: '',
    nominatorLastName: '',
    nominatorRole: '',
    nominatorEmail: '',
    nominatorPhone: '',
    
    // Nomination Details
    nominationReason: '',
    
    // Required Attestations
    cleanDrivingRecord: false,
    districtIsTaptMember: false,
    districtAttendedYear1: false,  // Dynamic year from settings
    districtAttendedYear2: false,  // Dynamic year from settings
    districtAttendedYear3: false,  // Dynamic year from settings
    nominatorIsOfficiallyListed: false,
    acknowledgeDocumentation: false,
    acknowledgeAttendance: false
  });


  const [formStatus, setFormStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  const [settings, setSettings] = useState<HallOfFameSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNominationPeriodOpen, setIsNominationPeriodOpen] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalContent, setSuccessModalContent] = useState({
    title: 'Nomination Submitted!',
    message: '',
    subMessage: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('hall_of_fame_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle instead of single

      if (error) {
        console.error('Error fetching hall of fame settings:', error);
        setError('Failed to load settings. Please try again later.');
        return;
      }

      if (!data) {
        setError('No active nomination period is available at this time.');
        return;
      }

      setSettings(data);

      // Check if we're within the nomination period
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      // Parse dates - handle both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SS' formats
      const startDateStr = data.start_date.includes('T') ? data.start_date.split('T')[0] : data.start_date;
      const [y1, m1, d1] = startDateStr.split('-').map(Number);
      const startDate = new Date(y1, m1 - 1, d1);
      
      const endDateStr = data.end_date.includes('T') ? data.end_date.split('T')[0] : data.end_date;
      const [y2, m2, d2] = endDateStr.split('-').map(Number);
      const endDate = new Date(y2, m2 - 1, d2);
      
      if (now < startDate) {
        setIsNominationPeriodOpen(false);
        setError(`Nominations open on ${startDate.toLocaleDateString()}`);
      } else if (now > endDate) {
        setIsNominationPeriodOpen(false);
        setError(`Nominations closed on ${endDate.toLocaleDateString()}`);
      } else {
        setIsNominationPeriodOpen(true);
        setError(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Format nomination period dates
  const getNominationPeriodDisplay = () => {
    if (!settings?.start_date || !settings?.end_date) return '';
    const startDateStr = settings.start_date.includes('T') ? settings.start_date.split('T')[0] : settings.start_date;
    const [y1, m1, d1] = startDateStr.split('-').map(Number);
    const endDateStr = settings.end_date.includes('T') ? settings.end_date.split('T')[0] : settings.end_date;
    const [y2, m2, d2] = endDateStr.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name === 'nominatorPhone') {
      // Only allow numbers and limit to 10 digits
      const numbersOnly = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({
        ...prev,
        [name]: numbersOnly
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Validate that all required fields and attestations are complete
  const isFormValid = () => {
    return (
      formData.nomineeFirstName.trim() &&
      formData.nomineeLastName.trim() &&
      formData.district.trim() &&
      formData.grandDivision &&
      formData.yearsOfService &&
      formData.nominatorFirstName.trim() &&
      formData.nominatorLastName.trim() &&
      formData.nominatorRole &&
      formData.nominatorEmail.trim() &&
      formData.nominatorPhone.length === 10 &&
      formData.nominationReason.trim() &&
      formData.cleanDrivingRecord &&
      formData.districtIsTaptMember &&
      formData.districtAttendedYear1 &&
      formData.districtAttendedYear2 &&
      formData.districtAttendedYear3 &&
      formData.nominatorIsOfficiallyListed &&
      formData.acknowledgeDocumentation &&
      formData.acknowledgeAttendance
    );
  };

  // SecureForm passes: (formData, isVerified, turnstileToken)
  const handleSecureSubmit = async (_formData: any, _isVerified: boolean, turnstileToken: string) => {
    if (!settings?.is_active) {
      throw new Error('Nominations are currently closed.');
    }

    if (!isNominationPeriodOpen) {
      throw new Error('The nomination period is not currently open.');
    }

    if (!isFormValid()) {
      throw new Error('Please complete all required fields and attestations.');
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration error. Please contact support.');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/submit-hof-nomination`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            // Nominee info
            nominee_first_name: formData.nomineeFirstName,
            nominee_last_name: formData.nomineeLastName,
            district: formData.district,
            grand_division: formData.grandDivision,
            years_of_service: parseInt(formData.yearsOfService),
            
            // Nominator info
            nominator_first_name: formData.nominatorFirstName,
            nominator_last_name: formData.nominatorLastName,
            nominator_role: formData.nominatorRole,
            nominator_email: formData.nominatorEmail,
            nominator_phone: formData.nominatorPhone,
            
            // Nomination details
            nomination_reason: formData.nominationReason,
            
            // Attestations - send with dynamic years from settings
            clean_driving_record: formData.cleanDrivingRecord,
            district_is_tapt_member: formData.districtIsTaptMember,
            // Dynamic year attestations - include both the year value and the checked status
            conference_year_1: settings.conference_year_1,
            conference_year_2: settings.conference_year_2,
            conference_year_3: settings.conference_year_3,
            district_attended_year_1: formData.districtAttendedYear1,
            district_attended_year_2: formData.districtAttendedYear2,
            district_attended_year_3: formData.districtAttendedYear3,
            nominator_is_officially_listed: formData.nominatorIsOfficiallyListed,
            acknowledge_documentation: formData.acknowledgeDocumentation,
            acknowledge_attendance: formData.acknowledgeAttendance,
            
            turnstileToken
          }),
        }
      );

      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Server communication error. Please try again.');
      }

      if (!response.ok) {
        throw new Error(result?.error || `Server error (${response.status}). Please try again.`);
      }

      // Success - Show modal
      setSuccessModalContent({
        title: 'Nomination Submitted!',
        message: 'Your Hall of Fame nomination has been successfully received.',
        subMessage: 'TAPT will contact you with documentation requirements. The nominee will not be considered a finalist until all documentation is received.'
      });
      setShowSuccessModal(true);
      setFormStatus({});

      // Reset form
      setFormData({
        nomineeFirstName: '',
        nomineeLastName: '',
        district: '',
        grandDivision: '',
        yearsOfService: '',
        nominatorFirstName: '',
        nominatorLastName: '',
        nominatorRole: '',
        nominatorEmail: '',
        nominatorPhone: '',
        nominationReason: '',
        cleanDrivingRecord: false,
        districtIsTaptMember: false,
        districtAttendedYear1: false,
        districtAttendedYear2: false,
        districtAttendedYear3: false,
        nominatorIsOfficiallyListed: false,
        acknowledgeDocumentation: false,
        acknowledgeAttendance: false
      });
    } catch (error: any) {
      console.error('Nomination error:', error);
      
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
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

  if (!settings?.is_active || !isNominationPeriodOpen) {
    return (
      <div className="pt-16">
        <section className="bg-secondary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">Hall of Fame Nomination</h1>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Award className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-secondary mb-4">The Nomination Process is Closed</h2>
              <p className="text-gray-600">
                {error || 'Thank you for your interest in the TAPT Hall of Fame. The nomination period has ended. Please check back later for the next nomination period.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pt-16">
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalContent.title}
        message={successModalContent.message}
        subMessage={successModalContent.subMessage}
      />

      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">{settings.name}</h1>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Nomination Period - Prominent Display */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-1">Nomination Period</h3>
                <p className="text-xl font-bold text-blue-700">
                  {getNominationPeriodDisplay()}
                </p>
              </div>
            </div>
          </div>

          {/* Important Notice - Who Can Submit */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <AlertTriangle className="h-6 w-6 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-amber-900 mb-2">Who Can Submit a Nomination?</h3>
                <p className="text-amber-800 text-sm">
                  Only the <strong>Transportation Supervisor officially listed with the Tennessee Department of Education</strong> or 
                  the <strong>Director of Schools</strong> may submit a nomination. Self-nominations and third-party nominations will not be accepted.
                </p>
              </div>
            </div>
          </div>

          {formStatus.message && (
            <div className={`mb-8 p-4 rounded-md ${formStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {formStatus.success ? (
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-9.293a1 1 0 011.414-1.414L11 10.586l1.293-1.293a1 1 0 111.414 1.414l-2 2a1 1 0 01-1.414 0l-4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
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

          <SecureForm onSubmit={handleSecureSubmit} className="bg-white shadow-lg rounded-lg p-8" submitButtonText="Submit Nomination">
            {/* Section 1: Nominee Information */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Nominee Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nomineeFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nomineeFirstName"
                    name="nomineeFirstName"
                    value={formData.nomineeFirstName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="nomineeLastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nomineeLastName"
                    name="nomineeLastName"
                    value={formData.nomineeLastName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">
                  School District <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="district"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Knox County Schools"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label htmlFor="grandDivision" className="block text-sm font-medium text-gray-700 mb-1">
                    Grand Division <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="grandDivision"
                    name="grandDivision"
                    value={formData.grandDivision}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {GRAND_DIVISIONS.map(division => (
                      <option key={division.value} value={division.value}>
                        {division.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">One winner selected per division</p>
                </div>

                <div>
                  <label htmlFor="yearsOfService" className="block text-sm font-medium text-gray-700 mb-1">
                    Years of Service <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="yearsOfService"
                    name="yearsOfService"
                    value={formData.yearsOfService}
                    onChange={handleChange}
                    required
                    min="1"
                    max="60"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be verified by district</p>
                </div>
              </div>
            </div>

            {/* Section 2: Nominator Information */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Nominator Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nominatorFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                    Your First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nominatorFirstName"
                    name="nominatorFirstName"
                    value={formData.nominatorFirstName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="nominatorLastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nominatorLastName"
                    name="nominatorLastName"
                    value={formData.nominatorLastName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="nominatorRole" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="nominatorRole"
                  name="nominatorRole"
                  value={formData.nominatorRole}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {NOMINATOR_ROLES.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label htmlFor="nominatorEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="nominatorEmail"
                    name="nominatorEmail"
                    value={formData.nominatorEmail}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="nominatorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="nominatorPhone"
                    name="nominatorPhone"
                    value={formData.nominatorPhone}
                    onChange={handleChange}
                    required
                    placeholder="10 digits"
                    maxLength={10}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Nomination Reason */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Nomination Statement
              </h2>
              
              <div>
                <label htmlFor="nominationReason" className="block text-sm font-medium text-gray-700 mb-1">
                  Why should this driver be inducted into the Hall of Fame? <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="nominationReason"
                  name="nominationReason"
                  value={formData.nominationReason}
                  onChange={handleChange}
                  required
                  rows={5}
                  maxLength={2000}
                  placeholder="Describe their service, professionalism, commitment to student safety, and why they exemplify the highest standards of pupil transportation..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.nominationReason.length}/2000 characters</p>
              </div>
            </div>

            {/* Section 4: Required Attestations */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Required Attestations
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                All boxes must be checked to submit this nomination.
              </p>

              <div className="space-y-4 bg-gray-50 rounded-lg p-4">
                {/* Nominee Attestations */}
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Nominee Eligibility</h3>
                  
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      name="cleanDrivingRecord"
                      checked={formData.cleanDrivingRecord}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      I attest that the nominee has a <strong>clean driving record</strong>. <span className="text-red-500">*</span>
                    </span>
                  </label>
                </div>

                {/* District Attestations */}
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">District Eligibility</h3>
                  
                  <label className="flex items-start mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="districtIsTaptMember"
                      checked={formData.districtIsTaptMember}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      Our school district is an <strong>active TAPT General Member</strong>. <span className="text-red-500">*</span>
                    </span>
                  </label>

                  <p className="text-sm text-gray-600 mb-2 ml-7">Our district attended TAPT Annual Conference in:</p>
                  
                  <div className="ml-7 space-y-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="districtAttendedYear1"
                        checked={formData.districtAttendedYear1}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="ml-3 text-sm text-gray-700">{settings?.conference_year_1 || '____'} <span className="text-red-500">*</span></span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="districtAttendedYear2"
                        checked={formData.districtAttendedYear2}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="ml-3 text-sm text-gray-700">{settings?.conference_year_2 || '____'} <span className="text-red-500">*</span></span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="districtAttendedYear3"
                        checked={formData.districtAttendedYear3}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="ml-3 text-sm text-gray-700">{settings?.conference_year_3 || '____'} <span className="text-red-500">*</span></span>
                    </label>
                  </div>
                </div>

                {/* Nominator Attestations */}
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Nominator Authorization</h3>
                  
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      name="nominatorIsOfficiallyListed"
                      checked={formData.nominatorIsOfficiallyListed}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      I am the <strong>Transportation Supervisor officially listed with the Tennessee Department of Education</strong> or 
                      the <strong>Director of Schools</strong> for this district. <span className="text-red-500">*</span>
                    </span>
                  </label>
                </div>

                {/* Acknowledgments */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Acknowledgments</h3>
                  
                  <label className="flex items-start mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="acknowledgeDocumentation"
                      checked={formData.acknowledgeDocumentation}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      I understand that TAPT will contact me with <strong>required documentation</strong> after submission, 
                      and the nominee will not be considered a finalist until all documentation is received. <span className="text-red-500">*</span>
                    </span>
                  </label>

                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      name="acknowledgeAttendance"
                      checked={formData.acknowledgeAttendance}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      I understand that if selected, the winner <strong>must attend the {settings?.award_year || '____'} TAPT Annual Conference</strong> in person 
                      to receive the award at the President's Awards Dinner. <span className="text-red-500">*</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Validation message - SecureForm provides the submit button */}
            {!isFormValid() && (
              <div className="mt-6">
                <p className="text-sm text-gray-500 text-center">
                  Please complete all required fields and attestations
                </p>
              </div>
            )}
          </SecureForm>
        </div>
      </section>
    </div>
  );
};

export default HallOfFameNomination;
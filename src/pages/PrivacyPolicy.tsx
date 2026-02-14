import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-tapt-navy text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="mx-auto mb-4 text-tapt-gold" size={48} />
          <h1 className="text-4xl font-heading font-bold mb-4">Privacy Policy</h1>
          <p className="text-gray-200 text-lg">
            Your privacy is important to the Tennessee Association of Pupil Transportation.
          </p>
          <p className="text-gray-300 text-sm mt-4">Last Updated: February 14, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 space-y-8">

          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              The Tennessee Association of Pupil Transportation ("TAPT," "we," "our," or "us") is committed to 
              protecting the privacy and security of your personal information. This Privacy Policy explains how 
              we collect, use, disclose, and safeguard your information when you visit our website (tapt.org and 
              tntapt.com), register for events, apply for membership, or interact with our services.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              By using our website and services, you consent to the data practices described in this policy. 
              If you do not agree with any part of this policy, please discontinue use of our website.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Personal Information You Provide</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              We may collect personal information that you voluntarily provide when you:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Register for conferences, workshops, or events</li>
              <li>Apply for membership</li>
              <li>Submit a contact form or inquiry</li>
              <li>Apply for student scholarships</li>
              <li>Submit a Hall of Fame nomination</li>
              <li>Register for regional luncheons</li>
              <li>Register as an exhibitor</li>
              <li>Process a payment through our website</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              This information may include your name, email address, phone number, mailing address, school 
              district or organization, job title, and payment information.
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Automatically Collected Information</h3>
            <p className="text-gray-700 leading-relaxed">
              When you access our website, we may automatically collect certain information including your 
              IP address, browser type, operating system, referring URLs, access times, and pages viewed. 
              This information helps us improve our website and services.
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Security Verification</h3>
            <p className="text-gray-700 leading-relaxed">
              We use Cloudflare Turnstile on our forms for bot protection and security verification. This 
              service may collect interaction data to distinguish human users from automated bots. For more 
              information, see{' '}
              <a 
                href="https://www.cloudflare.com/privacypolicy/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-tapt-navy hover:text-tapt-gold underline"
              >
                Cloudflare's Privacy Policy
              </a>.
            </p>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Process event registrations and membership applications</li>
              <li>Communicate with you about events, news, and association updates</li>
              <li>Process payments and send receipts</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Evaluate scholarship and award applications</li>
              <li>Improve our website, services, and user experience</li>
              <li>Comply with legal obligations</li>
              <li>Protect against fraud and unauthorized access</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Information Sharing and Disclosure</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information to third parties. We may share your 
              information in the following limited circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>
                <strong>Service Providers:</strong> We share information with trusted third-party service providers 
                who assist us in operating our website, processing payments (PayPal), hosting our data (Supabase), 
                and providing security services (Cloudflare). These parties are obligated to keep your information 
                confidential.
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose information when required by law, subpoena, 
                or other legal process, or when we believe disclosure is necessary to protect our rights or the 
                safety of others.
              </li>
              <li>
                <strong>Association Business:</strong> Certain information (such as names and districts) of registered 
                conference attendees or members may be shared with event organizers or included in association 
                directories, consistent with the purpose for which the information was collected.
              </li>
            </ul>
          </section>

          {/* Payment Information */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Payment Information</h2>
            <p className="text-gray-700 leading-relaxed">
              Payments processed through our website are handled by PayPal. We do not store your credit card 
              numbers or financial account information on our servers. Payment processing is subject to PayPal's 
              terms and privacy policy. We do retain transaction records including amounts, dates, and payment 
              confirmation details for our accounting and record-keeping purposes.
            </p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We implement reasonable administrative, technical, and physical safeguards to protect your 
              personal information from unauthorized access, use, alteration, or disclosure. These measures 
              include encrypted data transmission (HTTPS/TLS), secure database access controls, role-based 
              authentication, and regular security reviews. However, no method of transmission over the 
              Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes for which it 
              was collected, including to satisfy legal, accounting, or reporting requirements. Registration 
              records for conferences and events are maintained for historical and administrative purposes. 
              You may request deletion of your personal information by contacting us.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Cookies and Local Storage</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              This website uses only <strong>strictly necessary</strong> cookies and browser storage. 
              We do not use any advertising, analytics, or tracking cookies.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">What we use:</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>
                  <strong>Authentication tokens</strong> (Supabase) — stored in your browser's local 
                  storage to keep you logged in. These are removed when you log out.
                </li>
                <li>
                  <strong>Security cookies</strong> (Cloudflare Turnstile) — temporary cookies used 
                  to verify you are a real person when submitting forms. These expire automatically.
                </li>
              </ul>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Because we only use cookies that are strictly necessary for the website to function, 
              no consent is required under applicable privacy laws. You may configure your browser 
              to block cookies, but this may prevent login and form submissions from working properly.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Our website is not directed to children under the age of 13. We do not knowingly collect personal 
              information from children under 13. If you are a parent or guardian and believe your child has 
              provided us with personal information, please contact us so we can take appropriate action.
            </p>
          </section>

          {/* Third-Party Links */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Third-Party Links</h2>
            <p className="text-gray-700 leading-relaxed">
              Our website may contain links to third-party websites and services, including social media 
              platforms. We are not responsible for the privacy practices of these external sites. We encourage 
              you to review the privacy policies of any third-party site you visit.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of marketing communications at any time</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              To exercise any of these rights, please contact us using the information below.
            </p>
          </section>

          {/* Changes to This Policy */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with 
              an updated "Last Updated" date. We encourage you to review this policy periodically. Your 
              continued use of our website after changes are posted constitutes your acceptance of the revised 
              policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have questions or concerns about this Privacy Policy or our data practices, please 
              contact us:
            </p>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 font-semibold">Tennessee Association of Pupil Transportation</p>
              <div className="flex items-center mt-2 text-gray-600">
                <Mail size={16} className="mr-2 text-tapt-gold" />
                <Link to="/contact" className="text-tapt-navy hover:text-tapt-gold underline">
                  Contact Us Online
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

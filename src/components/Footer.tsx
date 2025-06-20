import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { getSiteSetting } from '../lib/siteSettings';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [contactEmail, setContactEmail] = useState<string>('contact@tapt.org');
  const [contactPhone, setContactPhone] = useState<string>('615-406-9199');
  const [businessHoursDays, setBusinessHoursDays] = useState<string>('Monday – Friday');
  const [businessHoursTime, setBusinessHoursTime] = useState<string>('8:00 AM – 4:30 PM CST');
  const [socialFacebook, setSocialFacebook] = useState<string>('https://facebook.com');
  const [socialTwitter, setSocialTwitter] = useState<string>('https://twitter.com');
  const [socialInstagram, setSocialInstagram] = useState<string>('https://instagram.com');
  const [footerText, setFooterText] = useState<string>('Promoting safe and efficient student transportation across Tennessee since 1977.');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const email = await getSiteSetting('contact_email');
        if (email) setContactEmail(email);

        const phone = await getSiteSetting('contact_phone');
        if (phone) setContactPhone(phone);

        const hoursDays = await getSiteSetting('business_hours_days');
        if (hoursDays) setBusinessHoursDays(hoursDays);

        const hoursTime = await getSiteSetting('business_hours_time');
        if (hoursTime) setBusinessHoursTime(hoursTime);

        const facebook = await getSiteSetting('social_facebook');
        if (facebook) setSocialFacebook(facebook);

        const twitter = await getSiteSetting('social_twitter');
        if (twitter) setSocialTwitter(twitter);

        const instagram = await getSiteSetting('social_instagram');
        if (instagram) setSocialInstagram(instagram);

        const footer = await getSiteSetting('footer_text');
        if (footer) setFooterText(footer);
      } catch (error) {
        console.error('Error fetching footer settings:', error);
      }
    };

    fetchSettings();
  }, []);

  return (
    <footer className="bg-secondary text-white">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <div className="flex flex-col h-full">
              <h2 className="text-xl font-bold text-white mb-4">TAPT</h2>
              <p className="text-gray-300 mb-4">Tennessee Association of Pupil Transportation</p>
              <p className="text-gray-300 mb-6">{footerText}</p>
              <div className="flex space-x-4 mt-auto">
                {socialFacebook && (
                  <a href={socialFacebook} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">
                    <Facebook size={20} />
                  </a>
                )}
                {socialTwitter && (
                  <a href={socialTwitter} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">
                    <Twitter size={20} />
                  </a>
                )}
                {socialInstagram && (
                  <a href={socialInstagram} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">
                    <Instagram size={20} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <h3 className="text-lg font-bold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-300 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/about" className="text-gray-300 hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/resources" className="text-gray-300 hover:text-white transition-colors">Resources</Link></li>
              <li><Link to="/news" className="text-gray-300 hover:text-white transition-colors">News</Link></li>
              <li><Link to="/events" className="text-gray-300 hover:text-white transition-colors">Events</Link></li>
              <li><Link to="/members" className="text-gray-300 hover:text-white transition-colors">Membership</Link></li>
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <h3 className="text-lg font-bold text-white mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><Link to="/resources" className="text-gray-300 hover:text-white transition-colors">Training Materials</Link></li>
              <li><Link to="/resources" className="text-gray-300 hover:text-white transition-colors">Safety Guidelines</Link></li>
              <li><Link to="/resources" className="text-gray-300 hover:text-white transition-colors">State Regulations</Link></li>
              <li><Link to="/resources" className="text-gray-300 hover:text-white transition-colors">Best Practices</Link></li>
              <li><Link to="/resources" className="text-gray-300 hover:text-white transition-colors">Forms & Documents</Link></li>
              <li><Link to="/resources" className="text-gray-300 hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <h3 className="text-lg font-bold text-white mb-4">Contact Us</h3>
            <address className="not-italic">
              <div className="flex items-start mb-3">
                <MapPin size={20} className="mr-2 mt-1 flex-shrink-0" />
                <span className="text-gray-300">P.O. Box 700<br />Portland, TN 37148</span>
              </div>
              <div className="flex items-start mb-3">
                <Phone size={20} className="mr-2 mt-1 flex-shrink-0" />
                <div>
                  <a href={`tel:+1${contactPhone.replace(/\D/g, '')}`} className="text-gray-300 hover:text-white">{contactPhone}</a>
                  <div className="text-gray-400 text-sm flex items-center mt-1">
                    <Clock size={14} className="mr-1" />
                    <span>{businessHoursDays}, {businessHoursTime}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <Mail size={20} className="mr-2 flex-shrink-0" />
                <a href={`mailto:${contactEmail}`} className="text-gray-300 hover:text-white">{contactEmail}</a>
              </div>
            </address>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-10 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-300 text-sm">&copy; {currentYear} Tennessee Association of Pupil Transportation. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="/privacy-policy" className="text-gray-300 text-sm hover:text-white">Privacy Policy</Link>
              <Link to="/terms-of-service" className="text-gray-300 text-sm hover:text-white">Terms of Service</Link>
              <Link to="/accessibility" className="text-gray-300 text-sm hover:text-white">Accessibility</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
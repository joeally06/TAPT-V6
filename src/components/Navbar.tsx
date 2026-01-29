import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getSiteSetting } from '../lib/siteSettings';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [siteTitle, setSiteTitle] = useState('TAPT');
  const [siteTagline, setSiteTagline] = useState('Tennessee Association of Pupil Transportation');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();

  // Toggle mobile menu
  const toggleMenu = () => setIsOpen(!isOpen);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close mobile menu when navigating
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  // Fetch site settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const title = await getSiteSetting('site_title');
        if (title) setSiteTitle('TAPT'); // Keep the short title as TAPT for the navbar
        
        const tagline = await getSiteSetting('site_tagline');
        if (tagline) setSiteTagline(tagline);
      } catch (error) {
        console.error('Error fetching navbar settings:', error);
      }
    };

    fetchSettings();
  }, []);

  const navItems = [
    { name: 'Home', path: '/' },
    { 
      name: 'Forms', 
      path: '/events',
      subItems: [
        { name: 'Conference Registration', path: '/conference-registration' },
        { name: 'Tech Conference Registration', path: '/tech-conference-registration' },
        { name: 'Regional Luncheon Registration', path: '/regional-luncheon-registration' },
        { name: 'Exhibitor Registration', path: '/exhibitor-registration' },
        { name: 'Student Scholarship', path: '/student-scholarship-application' }
      ]
    },
    { 
      name: 'Hall of Fame',
      path: '/hall-of-fame',
      subItems: [
        { name: 'Members', path: '/hall-of-fame-members' },
        { name: 'Nomination Form', path: '/hall-of-fame-nomination' }
      ]
    },
    { name: 'Members', path: '/members' },
    { name: 'Conference Gallery', path: '/conference-gallery' },
    { name: 'Resources', path: '/resources' },
    { 
      name: 'About', 
      path: '/about',
      subItems: [
        { name: 'Board Members', path: '/board-members' },
        { name: 'Contact', path: '/contact' }
      ]
    }
  ];

  const adminItems = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Users', path: '/admin/users' },
    { name: 'Board Members', path: '/admin/board-members' },
    { name: 'Site Settings', path: '/admin/site-settings' },
    { name: 'Conference Settings', path: '/admin/conference-settings' },
    { name: 'Conference Registrations', path: '/admin/conference-registrations' },
    { name: 'Photo Gallery', path: '/admin/photo-gallery' },
    { name: 'Tech Conference Settings', path: '/admin/tech-conference-settings' },
    { name: 'Tech Conference Registrations', path: '/admin/tech-conference-registrations' },
    { name: 'Exhibitor Settings', path: '/admin/exhibitor-settings' },
    { name: 'Exhibitor Registrations', path: '/admin/exhibitor-registrations' },
    { name: 'Student Scholarship Settings', path: '/admin/student-scholarship-settings' },
    { name: 'Student Scholarship Applications', path: '/admin/student-scholarship-applications' },
    { name: 'Hall of Fame Settings', path: '/admin/hall-of-fame-settings' },
    { name: 'Hall of Fame Members', path: '/admin/hall-of-fame-members' },
    { name: 'Hall of Fame Nominations', path: '/admin/hall-of-fame-nominations' }
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md py-2' : 'bg-white/90 backdrop-blur-sm py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center flex-shrink-0 min-w-0">
            <Link to="/" className="flex items-center">
              <span className="text-primary font-bold text-xl sm:text-2xl whitespace-nowrap">{siteTitle}</span>
              {/* Tagline hidden to maximize menu space */}
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-1 ml-4 flex-1 justify-end">
            {navItems.map((item) => (
              <div key={item.name} className="relative group">
                {item.subItems ? (
                  <div className="relative">
                    <button
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center ${
                        isActive(item.path)
                          ? 'text-primary border-b-2 border-primary'
                          : 'text-gray-700 hover:text-primary'
                      }`}
                    >
                      {item.name}
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </button>
                    <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="py-1">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            {subItem.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-gray-700 hover:text-primary'
                    }`}
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}

            {/* Admin Menu */}
            {isAdmin && (
              <div className="relative group">
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center ${
                    location.pathname.startsWith('/admin')
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-700 hover:text-primary'
                  }`}
                >
                  Admin
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
                <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="py-1">
                    {adminItems.map((item) => (
                      <Link
                        key={item.name}
                        to={item.path}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-primary focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 invisible'
        } overflow-hidden bg-white`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navItems.map((item) => (
            <div key={item.name}>
              {item.subItems ? (
                <div>
                  <div className="px-3 py-2 text-base font-medium text-gray-700">
                    {item.name}
                  </div>
                  <div className="pl-6">
                    {item.subItems.map((subItem) => (
                      <Link
                        key={subItem.name}
                        to={subItem.path}
                        className={`block px-3 py-2 rounded-md text-sm font-medium ${
                          isActive(subItem.path)
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-primary'
                        }`}
                      >
                        {subItem.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  to={item.path}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive(item.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-primary'
                  }`}
                >
                  {item.name}
                </Link>
              )}
            </div>
          ))}

          {/* Mobile Admin Menu */}
          {isAdmin && (
            <>
              <div className="px-3 py-2 text-base font-medium text-gray-700">
                Admin
              </div>
              <div className="pl-6">
                {adminItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`block px-3 py-2 rounded-md text-sm font-medium ${
                      isActive(item.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-primary'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
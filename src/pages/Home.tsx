import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Users, Calendar, BookOpen, AlertCircle, FileText, Download, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { NewsItem } from '../lib/types/news';
import { getSiteSetting } from '../lib/siteSettings';
import DOMPurify from 'dompurify';

export const Home: React.FC = () => {
  const [featuredEvents, setFeaturedEvents] = useState<NewsItem[]>([]);
  const [announcements, setAnnouncements] = useState<NewsItem[]>([]);
  const [heroImageUrl, setHeroImageUrl] = useState<string>('https://images.pexels.com/photos/5905700/pexels-photo-5905700.jpeg');
  const [siteTagline, setSiteTagline] = useState<string>('Promoting safe and efficient student transportation across Tennessee');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch hero image URL from site settings
        const imageUrl = await getSiteSetting('hero_image_url');
        if (imageUrl) {
          setHeroImageUrl(imageUrl);
        }
        
        // Fetch site tagline
        const tagline = await getSiteSetting('site_tagline');
        if (tagline) {
          setSiteTagline(tagline);
        }
        
        // Fetch featured events
        const { data, error } = await supabase
          .from('content')
          .select('*')
          .eq('type', 'event')
          .eq('status', 'published')
          .eq('is_featured', true)
          .order('date', { ascending: true });

        if (error) throw error;
        setFeaturedEvents(data || []);

        // Fetch announcements - security: only published, featured, limited to 5
        const { data: announcementsData, error: announcementsError } = await supabase
          .from('content')
          .select('*')
          .eq('type', 'announcement')
          .eq('status', 'published')
          .eq('is_featured', true)
          .order('created_at', { ascending: false })
          .limit(5);

        if (announcementsError) {
          console.error('Error fetching announcements:', announcementsError);
          // Don't throw - allow page to load even if announcements fail
        } else {
          setAnnouncements(announcementsData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Function to get the correct link for an event
  const getEventLink = (event: any) => {
    if (event.linked_form_type) {
      switch (event.linked_form_type) {
        case 'conference':
          return '/conference-registration';
        case 'tech-conference':
          return '/tech-conference-registration';
        case 'hall-of-fame':
          return '/hall-of-fame-nomination';
        case 'student-scholarship':
          return '/student-scholarship-application';
        default:
          return `/events/${event.id}`;
      }
    }
    
    // If there's a custom link, use it
    if (event.link) {
      return event.link;
    }
    
    // Default fallback
    return `/events/${event.id}`;
  };

  // Function to determine if the link is external
  const isExternalLink = (event: any) => {
    return event.link && (event.link.startsWith('http://') || event.link.startsWith('https://'));
  };

  return (
    <div className="pt-16 overflow-x-hidden">
      {/* Hero Section - Fixed Mobile Layout */}
      <section className="relative bg-gradient-to-r from-secondary to-primary text-white min-h-[60vh] sm:min-h-[70vh]">
        <div 
          className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-20" 
          style={{ backgroundImage: `url('${heroImageUrl}')` }}
        ></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 lg:py-28 relative z-10">
          <div className="max-w-full sm:max-w-2xl lg:max-w-3xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 sm:mb-6 slide-in-left break-words">
              Student Safety is Our Priority
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-100 mb-6 sm:mb-8 slide-in-left break-words" style={{ animationDelay: '0.1s' }}>
              Education is Our Destination! {siteTagline}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 slide-in-left" style={{ animationDelay: '0.2s' }}>
              <Link 
                to="/about" 
                className="bg-white text-primary hover:bg-gray-100 px-4 sm:px-6 py-2 sm:py-3 rounded-md font-medium inline-flex items-center justify-center transition-all text-sm sm:text-base"
              >
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link 
                to="/members" 
                className="bg-transparent text-white border border-white hover:bg-white/10 px-4 sm:px-6 py-2 sm:py-3 rounded-md font-medium transition-all text-sm sm:text-base text-center"
              >
                Become a Member
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Announcement Banner - Fixed Mobile Layout */}
      <div className="bg-accent/10 border-y border-accent/20">
        <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-start sm:items-center w-full">
              <AlertCircle className="flex-shrink-0 h-5 w-5 text-accent mt-0.5 sm:mt-0" />
              <p className="ml-3 font-medium text-secondary text-sm sm:text-base leading-relaxed">
                <span className="hidden md:inline">Important: </span>
                The site is currently under construction. Check back soon for more features and content!
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <Link 
                to="/contact" 
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-accent bg-white/50 hover:bg-white w-full sm:w-auto"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Events - Fixed Mobile Layout */}
      {featuredEvents.length > 0 && (
        <section className="py-8 sm:py-12 bg-gradient-to-b from-gray-100 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-secondary mb-2">Featured Events</h2>
              <div className="w-16 sm:w-20 h-1 bg-primary mx-auto"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {featuredEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {event.image_url && (
                    <img
                      className="w-full h-36 sm:h-48 object-cover"
                      src={event.image_url}
                      alt={event.title}
                    />
                  )}
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
                      <span className="px-2 sm:px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Featured Event
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-secondary mb-2 break-words">{event.title}</h3>
                    <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base break-words">{event.description}</p>
                    {isExternalLink(event) ? (
                      <a
                        href={event.link!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:text-primary/80 font-medium text-sm sm:text-base"
                      >
                        Learn More
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    ) : (
                      <Link
                        to={getEventLink(event)}
                        className="inline-flex items-center text-primary hover:text-primary/80 font-medium text-sm sm:text-base"
                      >
                        {event.linked_form_type ? 'Register Now' : 'Learn More'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Announcements Section - Fixed Mobile Layout */}
      {announcements.length > 0 && (
        <section className="py-8 sm:py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-secondary mb-2">Latest Announcements</h2>
              <div className="w-16 sm:w-20 h-1 bg-primary mx-auto"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {announcements.map((announcement) => {
                // Sanitize content to prevent XSS attacks
                const sanitizedTitle = DOMPurify.sanitize(announcement.title, { 
                  ALLOWED_TAGS: [],
                  KEEP_CONTENT: true 
                });
                const sanitizedDescription = DOMPurify.sanitize(announcement.description, { 
                  ALLOWED_TAGS: [],
                  KEEP_CONTENT: true 
                });
                
                // Validate file URL is from Supabase storage
                const hasValidFile = announcement.file_url && (() => {
                  try {
                    const fileUrlObj = new URL(announcement.file_url!);
                    return fileUrlObj.hostname.includes('supabase.co');
                  } catch {
                    return false;
                  }
                })();
                
                // Get file icon based on file type
                const getFileIcon = () => {
                  if (!announcement.file_type) return FileText;
                  if (announcement.file_type.includes('pdf')) return FileText;
                  if (announcement.file_type.includes('image')) return ImageIcon;
                  return FileText;
                };
                
                const FileIcon = getFileIcon();
                
                // Get file label based on type
                const getFileLabel = () => {
                  if (!announcement.file_type) return 'View Attachment';
                  if (announcement.file_type.includes('pdf')) return 'View PDF';
                  if (announcement.file_type.includes('image')) return 'View Image';
                  if (announcement.file_type.includes('word') || announcement.file_type.includes('document')) return 'View Document';
                  if (announcement.file_type.includes('excel') || announcement.file_type.includes('spreadsheet')) return 'View Spreadsheet';
                  return 'View Attachment';
                };
                
                return (
                  <div key={announcement.id} className="bg-gradient-to-br from-blue-50 to-white rounded-lg shadow-md overflow-hidden border border-blue-100 hover:shadow-lg transition-shadow">
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="px-2 sm:px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Announcement
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {new Date(announcement.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-secondary mb-2 break-words">
                        {sanitizedTitle}
                      </h3>
                      <p className="text-gray-600 text-sm sm:text-base break-words line-clamp-4">
                        {sanitizedDescription}
                      </p>
                      
                      {/* File Download Button */}
                      {hasValidFile && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <a
                            href={announcement.file_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
                            onClick={(e) => {
                              // Additional security check before download
                              try {
                                const url = new URL(announcement.file_url!);
                                if (!url.hostname.includes('supabase.co')) {
                                  e.preventDefault();
                                  console.error('Invalid file URL');
                                }
                              } catch {
                                e.preventDefault();
                              }
                            }}
                          >
                            <FileIcon className="h-4 w-4" />
                            <span>{getFileLabel()}</span>
                            <Download className="h-3 w-3" />
                          </a>
                          {announcement.file_size && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({(announcement.file_size / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Quick Links Section - Fixed Mobile Layout */}
      <section className="py-8 sm:py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow border-t-4 border-primary">
              <div className="flex items-center mb-3 sm:mb-4">
                <Calendar className="h-6 sm:h-8 w-6 sm:w-8 text-primary flex-shrink-0" />
                <h3 className="text-lg sm:text-xl font-semibold ml-3">Upcoming Events</h3>
              </div>
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Stay informed about conferences, workshops, and training opportunities.</p>
              <Link to="/events" className="text-primary font-medium inline-flex items-center hover:underline text-sm sm:text-base">
                View Calendar <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow border-t-4 border-primary">
              <div className="flex items-center mb-3 sm:mb-4">
                <BookOpen className="h-6 sm:h-8 w-6 sm:w-8 text-primary flex-shrink-0" />
                <h3 className="text-lg sm:text-xl font-semibold ml-3">Resources</h3>
              </div>
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Access guidelines, training materials, and important documentation.</p>
              <Link to="/resources" className="text-primary font-medium inline-flex items-center hover:underline text-sm sm:text-base">
                Browse Resources <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow border-t-4 border-primary">
              <div className="flex items-center mb-3 sm:mb-4">
                <Users className="h-6 sm:h-8 w-6 sm:w-8 text-primary flex-shrink-0" />
                <h3 className="text-lg sm:text-xl font-semibold ml-3">Membership</h3>
              </div>
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Join TAPT to connect with professionals and access exclusive benefits.</p>
              <Link to="/members" className="text-primary font-medium inline-flex items-center hover:underline text-sm sm:text-base">
                Join Today <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action - Fixed Mobile Layout */}
      <section className="bg-gradient-to-r from-primary to-accent py-12 sm:py-16 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6 break-words">Ready to connect with transportation professionals?</h2>
          <p className="text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto break-words">Join the Tennessee Association of Pupil Transportation today to access exclusive resources, networking opportunities, and professional development.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <Link 
              to="/members" 
              className="bg-white text-primary hover:bg-gray-100 px-6 sm:px-8 py-2 sm:py-3 rounded-md font-medium transition-colors text-sm sm:text-base"
            >
              Join TAPT
            </Link>
            <Link 
              to="/contact" 
              className="bg-transparent border border-white hover:bg-white/10 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-md font-medium transition-colors text-sm sm:text-base"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
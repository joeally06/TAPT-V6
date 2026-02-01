import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Users, Calendar, BookOpen, AlertCircle, FileText, Download, Image as ImageIcon, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { NewsItem } from '../lib/types/news';
import { getSiteSetting } from '../lib/siteSettings';
import DOMPurify from 'dompurify';

export const Home: React.FC = () => {
  const [featuredEvents, setFeaturedEvents] = useState<NewsItem[]>([]);
  const [announcements, setAnnouncements] = useState<NewsItem[]>([]);
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
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
        case 'exhibitor':
          return '/exhibitor-registration';
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
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImageUrl} 
            alt="Hero" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/50 to-transparent"></div>
        </div>
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="max-w-2xl">
            <h1 className="text-white text-4xl sm:text-5xl md:text-6xl font-bold mb-4 [text-shadow:_2px_2px_4px_rgb(0_0_0_/_80%)]">
              Tennessee Association of Pupil Transportation
            </h1>
            <p className="text-white text-xl sm:text-2xl mb-8 [text-shadow:_1px_1px_3px_rgb(0_0_0_/_70%)]">
              {siteTagline}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/about"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-base font-medium rounded-md text-white hover:bg-white hover:text-primary transition-colors"
              >
                Learn More
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

      {/* Featured Events - Horizontal Scroll */}
      {featuredEvents.length > 0 && (
        <section className="py-8 sm:py-12 bg-gradient-to-b from-gray-100 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-tapt-navy mb-2">Featured Events</h2>
                <div className="w-16 sm:w-20 h-1 bg-tapt-blue"></div>
              </div>
              <Link 
                to="/events" 
                className="hidden sm:inline-flex items-center text-tapt-blue hover:text-tapt-navy font-semibold"
              >
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            
            {/* Mobile: Horizontal Scroll, Desktop: Grid */}
            <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
              <div className="flex gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                {featuredEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all flex-shrink-0 w-80 sm:w-auto group"
                  >
                    {event.image_url ? (
                      <div className="relative h-48 overflow-hidden">
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          src={event.image_url}
                          alt={event.title}
                        />
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-tapt-gold text-white shadow-lg">
                            Featured
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-tapt-blue/10 to-tapt-navy/10 flex items-center justify-center">
                        <Calendar className="h-16 w-16 text-tapt-blue/30" />
                      </div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-3 text-sm text-tapt-blue">
                        <Calendar className="h-4 w-4" />
                        <time dateTime={event.date}>
                          {new Date(event.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </time>
                      </div>
                      
                      <h3 className="text-xl font-bold text-tapt-navy mb-2 line-clamp-2 group-hover:text-tapt-blue transition-colors">
                        {event.title}
                      </h3>
                      
                      <p className="text-gray-600 mb-4 text-sm line-clamp-3">
                        {event.description}
                      </p>
                      
                      {isExternalLink(event) ? (
                        <a
                          href={event.link!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-tapt-blue hover:text-tapt-navy font-semibold text-sm group/link"
                        >
                          Learn More
                          <ArrowRight className="ml-2 h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                        </a>
                      ) : (
                        <Link
                          to={getEventLink(event)}
                          className="inline-flex items-center text-tapt-blue hover:text-tapt-navy font-semibold text-sm group/link"
                        >
                          {event.linked_form_type ? 'Register Now' : 'Learn More'}
                          <ArrowRight className="ml-2 h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Mobile: View All Link */}
            <div className="mt-6 text-center sm:hidden">
              <Link 
                to="/events" 
                className="inline-flex items-center text-tapt-blue hover:text-tapt-navy font-semibold"
              >
                View All Events <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Announcements Section - Card Grid Design */}
      {announcements.length > 0 && (
        <section className="py-8 sm:py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-tapt-navy mb-2">Latest Announcements</h2>
                <div className="w-16 sm:w-20 h-1 bg-tapt-blue"></div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {announcements.map((announcement, index) => {
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
                
                const isLatest = index === 0;
                
                return (
                  <div 
                    key={announcement.id} 
                    className={`bg-white rounded-xl shadow-md overflow-hidden border hover:shadow-lg transition-all group flex flex-col ${
                      isLatest ? 'border-tapt-blue/30 ring-2 ring-tapt-blue/10' : 'border-gray-100'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-5 flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {isLatest && (
                            <span className="px-2 py-1 text-xs font-bold rounded-full bg-tapt-blue text-white">
                              New
                            </span>
                          )}
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            Announcement
                          </span>
                        </div>
                      </div>
                      
                      <h4 className={`font-bold text-tapt-navy mb-2 group-hover:text-tapt-blue transition-colors line-clamp-2 ${
                        isLatest ? 'text-lg' : 'text-base'
                      }`}>
                        {sanitizedTitle}
                      </h4>
                      
                      <p className="text-gray-600 text-sm line-clamp-3 mb-3">
                        {sanitizedDescription}
                      </p>
                      
                      <time className="text-xs text-gray-400" dateTime={announcement.created_at}>
                        {new Date(announcement.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </time>
                    </div>
                    
                    {/* Card Footer - Attachment */}
                    {hasValidFile && (
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                        <a
                          href={announcement.file_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-tapt-blue hover:text-tapt-navy font-medium transition-colors"
                          onClick={(e) => {
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
                          <Download className="h-3 w-3 ml-auto" />
                        </a>
                      </div>
                    )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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

      {/* Bottom CTA Section - Upcoming Events & Contact */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {/* Upcoming Events Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 hover:shadow-xl transition-shadow border-t-4 border-primary">
              <div className="flex items-center mb-4">
                <Calendar className="h-8 w-8 text-primary flex-shrink-0" />
                <h3 className="text-2xl font-semibold ml-3">Upcoming Events</h3>
              </div>
              <p className="text-gray-600 mb-6 text-base">Stay informed about conferences, workshops, and training opportunities throughout Tennessee.</p>
              <Link 
                to="/events" 
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white rounded-md font-medium hover:bg-tapt-navy transition-colors w-full sm:w-auto"
              >
                View Calendar <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
            
            {/* Contact Us Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 hover:shadow-xl transition-shadow border-t-4 border-accent">
              <div className="flex items-center mb-4">
                <Users className="h-8 w-8 text-accent flex-shrink-0" />
                <h3 className="text-2xl font-semibold ml-3">Contact Us</h3>
              </div>
              <p className="text-gray-600 mb-6 text-base">Have questions? Our team is here to help you with membership, events, and resources.</p>
              <Link 
                to="/contact" 
                className="inline-flex items-center justify-center px-6 py-3 bg-accent text-white rounded-md font-medium hover:bg-orange-600 transition-colors w-full sm:w-auto"
              >
                Get in Touch <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Users, Calendar, BookOpen, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { NewsItem } from '../lib/types/news';
import { getSiteSetting } from '../lib/siteSettings';

export const Home: React.FC = () => {
  const [featuredEvents, setFeaturedEvents] = useState<NewsItem[]>([]);
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
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-secondary to-primary text-white">
        <div className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-20" style={{ backgroundImage: `url('${heroImageUrl}')` }}></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-32 relative z-10">
          <div className="md:max-w-2xl lg:max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 slide-in-left">
              Student Safety is Our Priority
            </h1>
            <p className="text-lg md:text-xl text-gray-100 mb-8 slide-in-left" style={{ animationDelay: '0.1s' }}>
              Education is Our Destination! {siteTagline}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 slide-in-left" style={{ animationDelay: '0.2s' }}>
              <Link to="/about" className="bg-white text-primary hover:bg-gray-100 px-6 py-3 rounded-md font-medium inline-flex items-center transition-all">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link to="/members" className="bg-transparent text-white border border-white hover:bg-white/10 px-6 py-3 rounded-md font-medium transition-all">
                Become a Member
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Announcement Banner */}
      <div className="bg-accent/10 border-y border-accent/20">
        <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex-1 flex items-center">
              <AlertCircle className="flex-shrink-0 h-5 w-5 text-accent" />
              <p className="ml-3 font-medium text-secondary truncate">
                <span className="hidden md:inline">Important: </span>
                The site is currently under construction. Check back soon for more features and content!
              </p>
            </div>
            <div className="order-3 mt-2 w-full sm:mt-0 sm:w-auto">
              <Link to="/contact" className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-accent bg-white/50 hover:bg-white">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Events */}
      {featuredEvents.length > 0 && (
        <section className="py-12 bg-gradient-to-b from-gray-100 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-secondary mb-2">Featured Events</h2>
              <div className="w-20 h-1 bg-primary mx-auto"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {event.image_url && (
                    <img
                      className="w-full h-48 object-cover"
                      src={event.image_url}
                      alt={event.title}
                    />
                  )}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Featured Event
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-secondary mb-2">{event.title}</h3>
                    <p className="text-gray-600 mb-4">{event.description}</p>
                    {isExternalLink(event) ? (
                      <a
                        href={event.link!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
                      >
                        Learn More
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    ) : (
                      <Link
                        to={getEventLink(event)}
                        className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
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

      {/* Quick Links Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-primary">
              <div className="flex items-center mb-4">
                <Calendar className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold ml-3">Upcoming Events</h3>
              </div>
              <p className="text-gray-600 mb-4">Stay informed about conferences, workshops, and training opportunities.</p>
              <Link to="/events" className="text-primary font-medium inline-flex items-center hover:underline">
                View Calendar <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-primary">
              <div className="flex items-center mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold ml-3">Resources</h3>
              </div>
              <p className="text-gray-600 mb-4">Access guidelines, training materials, and important documentation.</p>
              <Link to="/resources" className="text-primary font-medium inline-flex items-center hover:underline">
                Browse Resources <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-primary">
              <div className="flex items-center mb-4">
                <Users className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold ml-3">Membership</h3>
              </div>
              <p className="text-gray-600 mb-4">Join TAPT to connect with professionals and access exclusive benefits.</p>
              <Link to="/members" className="text-primary font-medium inline-flex items-center hover:underline">
                Join Today <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gradient-to-r from-primary to-accent py-16 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to connect with transportation professionals?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">Join the Tennessee Association of Pupil Transportation today to access exclusive resources, networking opportunities, and professional development.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/members" className="bg-white text-primary hover:bg-gray-100 px-8 py-3 rounded-md font-medium transition-colors">
              Join TAPT
            </Link>
            <Link to="/contact" className="bg-transparent border border-white hover:bg-white/10 text-white px-8 py-3 rounded-md font-medium transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
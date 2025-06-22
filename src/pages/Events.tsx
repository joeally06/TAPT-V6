import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  featured: boolean;
  is_featured: boolean;
  image_url: string | null;
  date: string;
  category: string;
  link: string | null;
  created_at: string;
  linked_form_type: 'conference' | 'tech-conference' | 'hall-of-fame' | null;
}

export const Events: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('type', 'event')
        .eq('status', 'published')
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on current filter
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    
    const eventDate = new Date(event.date);
    const now = new Date();
    
    return filter === 'upcoming' ? eventDate >= now : eventDate < now;
  });

  // Find featured event
  const featuredEvent = events.find(event => event.is_featured);

  // Function to get the correct link for an event
  const getEventLink = (event: Event) => {
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
  const isExternalLink = (event: Event) => {
    return event.link && (event.link.startsWith('http://') || event.link.startsWith('https://'));
  };

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">Events & Training</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Discover upcoming conferences, workshops, and training opportunities for transportation professionals.</p>
          </div>
        </div>
      </section>

      {/* Featured Event Section (if available) */}
      {featuredEvent && (
        <section className="py-12 bg-gradient-to-b from-gray-100 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-secondary mb-2">Featured Event</h2>
              <div className="w-20 h-1 bg-primary mx-auto"></div>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="md:flex">
                <div className="md:flex-shrink-0">
                  {featuredEvent.image_url ? (
                    <img
                      className="h-60 w-full object-cover md:w-64 md:h-full"
                      src={featuredEvent.image_url}
                      alt={featuredEvent.title}
                    />
                  ) : (
                    <div className="h-60 w-full md:w-64 md:h-full bg-gray-200 flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="p-8">
                  <div className="uppercase tracking-wide text-sm text-primary font-semibold">Don't Miss!</div>
                  <h3 className="mt-1 text-2xl font-bold text-secondary leading-tight">
                    {featuredEvent.title}
                  </h3>
                  <div className="mt-3 flex items-center text-gray-600">
                    <Calendar className="h-5 w-5 mr-2" />
                    <span>{new Date(featuredEvent.date).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-4 text-gray-600">
                    {featuredEvent.description}
                  </p>
                  {isExternalLink(featuredEvent) ? (
                    <a
                      href={featuredEvent.link!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                    >
                      Event Details
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </a>
                  ) : (
                    <Link
                      to={getEventLink(featuredEvent)}
                      className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                    >
                      {featuredEvent.linked_form_type ? 'Register Now' : 'Event Details'}
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Events Listing */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter Tabs */}
          <div className="mb-8 border-b border-gray-200">
            <div className="flex space-x-8">
              {[
                { key: 'upcoming', label: 'Upcoming Events' },
                { key: 'past', label: 'Past Events' },
                { key: 'all', label: 'All Events' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    filter === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-12">
                <div className="bg-gray-100 p-4 rounded-full">
                  <Calendar className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No events found</h3>
                <p className="mt-1 text-sm text-gray-500">Check back soon for updates or adjust your filter.</p>
              </div>
            ) : (
              filteredEvents.map(event => (
                <div key={event.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow">
                  {event.image_url ? (
                    <img 
                      src={event.image_url} 
                      alt={event.title} 
                      className="w-full h-48 object-cover transform hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="h-48 bg-gray-200 flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="p-6">
                    {event.status === 'past' && (
                      <div className="inline-block px-2 py-1 mb-3 rounded bg-gray-100 text-gray-800 text-xs uppercase tracking-wide font-semibold">
                        Past Event
                      </div>
                    )}
                    
                    <h3 className="text-xl font-bold text-secondary mb-3">{event.title}</h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-5 w-5 mr-2 text-gray-400" />
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {event.description}
                    </p>
                    
                    {isExternalLink(event) ? (
                      <a
                        href={event.link!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-primary font-medium hover:underline"
                      >
                        Event Details <ChevronRight className="inline h-4 w-4" />
                      </a>
                    ) : (
                      <Link
                        to={getEventLink(event)}
                        className="inline-block text-primary font-medium hover:underline"
                      >
                        {event.linked_form_type ? 'Register Now' : 'Event Details'} <ChevronRight className="inline h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Calendar Download */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="md:flex">
              <div className="p-8 md:flex-1">
                <h2 className="text-2xl font-bold text-secondary mb-4">TAPT Event Calendar</h2>
                <p className="text-gray-600 mb-6">
                  Download or subscribe to our event calendar to stay up-to-date with all TAPT events, workshops, and important dates.
                </p>
                <div className="space-y-4">
                  <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                    <Calendar className="mr-2 h-5 w-5" />
                    Add to Calendar
                  </button>
                  <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                    <Calendar className="mr-2 h-5 w-5 text-gray-500" />
                    Download iCal File
                  </button>
                </div>
              </div>
              <div className="md:flex-shrink-0 md:w-1/3 bg-gradient-to-br from-primary to-secondary p-8 text-white flex items-center">
                <div>
                  <h3 className="text-xl font-bold mb-3">Host Your Own Event</h3>
                  <p className="mb-4">Are you interested in hosting a TAPT workshop or event in your district?</p>
                  <Link
                    to="/contact"
                    className="inline-flex items-center px-4 py-2 border border-white rounded-md text-sm font-medium text-primary bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-offset-primary"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Events;
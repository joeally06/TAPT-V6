import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, Search, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { NewsFilters } from '../lib/types/news';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  featured: boolean;
  image_url: string | null;
  date: string;
  category: string;
  link: string | null;
  created_at: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

const NewsCard: React.FC<{ item: NewsItem; categoryName: string }> = React.memo(({ item, categoryName }) => (
  <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all">
    {item.image_url && (
      <img src={item.image_url} alt="" className="w-full h-48 object-cover" />
    )}
    <div className="p-6">
      <div className="flex items-center text-sm text-gray-500 mb-4">
        <Calendar className="h-4 w-4 mr-2" />
        {new Date(item.date || item.created_at).toLocaleDateString()}
        {item.type === 'announcement' ? (
          <span className="ml-4 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            Announcement
          </span>
        ) : (
          <>
            <Tag className="h-4 w-4 ml-4 mr-2" />
            {categoryName}
          </>
        )}
      </div>
      <h2 className="text-xl font-bold text-secondary mb-2">{item.title}</h2>
      <p className="text-gray-600 mb-4">{item.description}</p>
      {item.link ? (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 font-medium"
        >
          Read More →
        </a>
      ) : (
        <Link
          to={`/news/${item.id}`}
          className="text-primary hover:text-primary/80 font-medium"
        >
          Read More →
        </Link>
      )}
    </div>
  </article>
));

export const News: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  // Combined filters state to prevent race conditions
  const [filters, setFilters] = useState<NewsFilters>({
    searchQuery: '',
    category: 'all'
  });

  // Fetch news items from Supabase
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('content')
          .select('*')
          .in('type', ['news', 'announcement'])  // Fetch both news and announcements
          .eq('status', 'published')
          .order('date', { ascending: false, nullsLast: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNewsItems(data || []);
      } catch (err) {
        console.error('Error fetching news:', err);
        setError('Failed to load news items');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Memoized categories
  const categories: CategoryOption[] = useMemo(() => [
    { id: 'all', name: 'All Categories' },
    { id: 'announcements', name: 'Announcements' },
    { id: 'events', name: 'Events' },
    { id: 'safety', name: 'Safety' },
    { id: 'regulations', name: 'Regulations' },
    { id: 'industry', name: 'Industry News' },
  ], []);

  // Memoized category lookup map
  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  // Debounced filter updates
  const updateFilters = useCallback((updates: Partial<NewsFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Memoized search handler with debounce
  const handleSearch = useCallback((value: string) => {
    const timeoutId = setTimeout(() => {
      updateFilters({ searchQuery: value });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [updateFilters]);

  // Memoized filtered news items
  const filteredNews = useMemo(() => {
    return newsItems.filter(item => {
      const matchesSearch = filters.searchQuery === '' || 
        item.title.toLowerCase().includes(filters.searchQuery.toLowerCase()) || 
        item.description.toLowerCase().includes(filters.searchQuery.toLowerCase());
        
      // For announcements, check if the filter is 'all' or 'announcements'
      if (item.type === 'announcement') {
        return matchesSearch && (filters.category === 'all' || filters.category === 'announcements');
      }
      
      // For news items, check category as before
      const matchesCategory = filters.category === 'all' || item.category === filters.category;
      
      return matchesSearch && matchesCategory;
    });
  }, [filters, newsItems]);

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">News & Updates</h1>
            <p className="text-xl text-gray-200">Stay informed about the latest developments in pupil transportation.</p>
          </div>
        </div>
      </section>

      {/* News Filters */}
      <section className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search news..."
                value={filters.searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
            
            <div className="flex space-x-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => updateFilters({ category: category.id })}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    filters.category === category.id
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* News Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredNews.map((item) => (
                <NewsCard 
                  key={item.id} 
                  item={item} 
                  categoryName={item.type === 'announcement' ? 'Announcement' : (categoryMap[item.category] || 'Uncategorized')} 
                />
              ))}
            </div>
          )}

          {!loading && !error && filteredNews.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No news items found matching your criteria.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default News;
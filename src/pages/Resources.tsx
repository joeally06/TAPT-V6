import React, { useEffect, useState } from 'react';
import { Search, Download, FileText, Book, FileCheck, Folder, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FixedSizeList } from 'react-window';

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

// Add new interface for link content
interface LinkContent {
  id: string;
  title: string;
  description: string;
  link: string;
  created_at: string;
  updated_at: string;
}

// Extended resource categories to include Links
const EXTENDED_RESOURCE_CATEGORIES = [
  { id: 'all', name: 'All Resources' },
  { id: 'manuals', name: 'Manuals & Guides' },
  { id: 'forms', name: 'Forms & Documents' },
  { id: 'laws', name: 'Laws & Regulations' },
  { id: 'training', name: 'Training Materials' },
  { id: 'safety', name: 'Safety Resources' },
  { id: 'links', name: 'External Links' }
] as const;

type ExtendedResourceCategory = typeof EXTENDED_RESOURCE_CATEGORIES[number]['id'];

const PAGE_SIZE = 12;

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getCategoryIcon = (category: string) => {
  try {
    switch(category) {
      case 'manuals':
        return <Book className="h-6 w-6" />;
      case 'forms':
        return <FileCheck className="h-6 w-6" />;
      case 'laws':
        return <FileText className="h-6 w-6" />;
      case 'training':
        return <Folder className="h-6 w-6" />;
      case 'safety':
        return <FileText className="h-6 w-6" />;
      case 'links':
        return <ExternalLink className="h-6 w-6" />;
      default:
        console.warn('Unknown category for icon:', category);
        return <FileText className="h-6 w-6" />;
    }
  } catch (e) {
    console.error('Error rendering icon for category', category, e);
    return null;
  }
};

const ResourceCard: React.FC<{ resource: Resource; onDownload: (resource: Resource) => void; style?: React.CSSProperties }> = ({ resource, onDownload, style }) => (
  <div style={style} className="py-6 flex flex-col md:flex-row md:items-center">
    <div className="flex-shrink-0 mr-4 mb-4 md:mb-0 bg-primary/10 p-4 rounded-md">
      {getCategoryIcon(resource.category)}
    </div>
    <div className="flex-grow">
      <h3 className="text-lg font-semibold text-secondary">{resource.title}</h3>
      <p className="text-gray-600 mb-2">{resource.description}</p>
      <div className="flex flex-wrap items-center text-sm text-gray-500 gap-x-4">
        <span>Updated: {new Date(resource.updated_at).toLocaleDateString()}</span>
        <span>{resource.file_type.toUpperCase()}</span>
        <span>{formatFileSize(resource.file_size)}</span>
      </div>
    </div>
    <div className="mt-4 md:mt-0 flex-shrink-0">
      <button
        onClick={() => onDownload(resource)}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        <Download className="mr-2 h-4 w-4" />
        Download
      </button>
    </div>
  </div>
);

const LinkCard: React.FC<{ 
  linkContent: LinkContent; 
  onVisit: (linkContent: LinkContent) => void; 
  style?: React.CSSProperties 
}> = ({ linkContent, onVisit, style }) => (
  <div style={style} className="py-6 flex flex-col md:flex-row md:items-center">
    <div className="flex-shrink-0 mr-4 mb-4 md:mb-0 bg-blue-100 p-4 rounded-md">
      <ExternalLink className="h-6 w-6 text-blue-600" />
    </div>
    <div className="flex-grow">
      <h3 className="text-lg font-semibold text-secondary">{linkContent.title}</h3>
      <p className="text-gray-600 mb-2">{linkContent.description}</p>
      <div className="flex flex-wrap items-center text-sm text-gray-500 gap-x-4">
        <span>Updated: {new Date(linkContent.updated_at).toLocaleDateString()}</span>
        <span className="text-blue-600 truncate max-w-xs" title={linkContent.link}>
          {linkContent.link.length > 50 ? `${linkContent.link.substring(0, 50)}...` : linkContent.link}
        </span>
      </div>
    </div>
    <div className="mt-4 md:mt-0 flex-shrink-0">
      <button
        onClick={() => onVisit(linkContent)}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Visit Link
      </button>
    </div>
  </div>
);

export const Resources: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<ExtendedResourceCategory>('all');
  const [resources, setResources] = useState<Resource[]>([]);
  const [linkContent, setLinkContent] = useState<LinkContent[]>([]); // New state
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (activeCategory === 'links') {
      fetchLinkContent();
    } else {
      fetchResources();
    }
    // eslint-disable-next-line
  }, [page, activeCategory, searchQuery]);

  // New function to fetch link content
  const fetchLinkContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('content')
        .select('*', { count: 'exact' })
        .eq('type', 'links')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;

      // Transform content data to match LinkContent interface
      const transformedData: LinkContent[] = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        link: item.link,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      setLinkContent(transformedData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching link content:', err);
      setError('Failed to load external links');
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('resources')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (searchQuery) {
        query = query.textSearch('title', searchQuery);
      }
      if (activeCategory !== 'all' && activeCategory !== 'links') {
        query = query.eq('category', activeCategory);
      }
      console.log('Fetching resources with query:', { from, to, searchQuery, activeCategory });
      const { data, error, count } = await query;
      console.log('Supabase response:', { data, error, count });
      if (error) throw error;
      setResources(data || []);
      setTotalCount(count || 0);
      console.log('Resources set:', data);
    } catch (err) {
      console.error('Error fetching resources:', err);
      setError('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resource: Resource) => {
    try {
      const checkResponse = await fetch(resource.file_url, { method: 'HEAD' });
      if (!checkResponse.ok) {
        throw new Error('Resource not found');
      }
      const link = document.createElement('a');
      link.href = resource.file_url;
      link.download = resource.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading resource:', error);
      alert('Sorry, this resource is currently unavailable. Please try again later.');
    }
  };

  const handleVisit = (linkContent: LinkContent) => {
    // Open link in new tab
    window.open(linkContent.link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">Resources</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Access guidelines, forms, and educational materials to support your transportation program.</p>
          </div>
        </div>
      </section>

      {/* Resource Center */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow-md rounded-lg p-6 md:p-8">
            {/* Search and Filter */}
            <div className="mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Search Bar */}
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary transition duration-150 ease-in-out"
                    placeholder="Search resources..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  />
                </div>
                {/* Category Tabs (Desktop) */}
                <div className="hidden md:flex space-x-2">
                  {EXTENDED_RESOURCE_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => { setActiveCategory(category.id); setPage(1); }}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeCategory === category.id
                          ? 'bg-primary text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {/* Category Select (Mobile) */}
                <div className="md:hidden w-full">
                  <select
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md"
                    value={activeCategory}
                    onChange={(e) => { setActiveCategory(e.target.value as ExtendedResourceCategory); setPage(1); }}
                  >
                    {EXTENDED_RESOURCE_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {/* Results */}
            <div className="space-y-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-red-600">{error}</p>
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-600 mb-4">
                    {activeCategory === 'links' ? (
                      linkContent.length === 0 ? 'No external links found' : 
                      `Showing ${(page - 1) * PAGE_SIZE + 1}-${(page - 1) * PAGE_SIZE + linkContent.length} of ${totalCount} external links`
                    ) : (
                      resources.length === 0 ? 'No resources found' : 
                      `Showing ${(page - 1) * PAGE_SIZE + 1}-${(page - 1) * PAGE_SIZE + resources.length} of ${totalCount} resources`
                    )}
                  </div>
                  
                  {activeCategory === 'links' ? (
                    // Render link content
                    <div className="divide-y divide-gray-200">
                      {linkContent.map((link) => (
                        <LinkCard key={link.id} linkContent={link} onVisit={handleVisit} />
                      ))}
                    </div>
                  ) : (
                    // Render file resources
                    <>
                      {resources.length > 0 && resources.length > 8 ? (
                        <FixedSizeList
                          height={Math.min(8, resources.length) * 120}
                          width="100%"
                          itemCount={resources.length}
                          itemSize={120}
                          className="divide-y divide-gray-200"
                        >
                          {({ index, style }) => (
                            <ResourceCard
                              resource={resources[index]}
                              onDownload={handleDownload}
                              style={style}
                            />
                          )}
                        </FixedSizeList>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {resources.map((resource) => (
                            <ResourceCard key={resource.id} resource={resource} onDownload={handleDownload} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Pagination Controls - show for both types */}
                  <div className="flex justify-between items-center mt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span>Page {page}</span>
                    <button
                      onClick={() => setPage((p) => (p * PAGE_SIZE < totalCount ? p + 1 : p))}
                      disabled={page * PAGE_SIZE >= totalCount}
                      className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* Request Resources */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-50 rounded-lg shadow-inner p-8 md:p-10">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-secondary mb-4">Need a specific resource?</h2>
              <p className="text-lg text-gray-600 mb-8">
                If you can't find what you're looking for, our team is here to help. Contact us with your resource request.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Request a Resource
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Resources;
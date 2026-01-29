export interface NewsItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  featured: boolean;
  image_url: string | null;
  date: string;
  category: NewsCategory;
  link: string | null;
  created_at: string;
  is_featured: boolean;
  file_url?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

export type NewsCategory = 'announcements' | 'events' | 'safety' | 'regulations' | 'industry';

export interface CategoryOption {
  id: NewsCategory | 'all';
  name: string;
}

export interface NewsFilters {
  searchQuery: string;
  category: NewsCategory | 'all';
}

export const NEWS_CATEGORIES: CategoryOption[] = [
  { id: 'all', name: 'All Categories' },
  { id: 'announcements', name: 'Announcements' },
  { id: 'events', name: 'Events' },
  { id: 'safety', name: 'Safety' },
  { id: 'regulations', name: 'Regulations' },
  { id: 'industry', name: 'Industry News' },
];
export interface NewsItem {
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
  is_featured: boolean;
  is_pinned?: boolean;
  publish_at?: string | null;
  expires_at?: string | null;
  file_url?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

export interface NewsFilters {
  searchQuery: string;
  // 'all' or one of the announcement categories
  category: string;
}

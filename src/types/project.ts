export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Newsletter {
  id: string;
  project_id: string;
  title: string;
  subject: string;
  content: string;
  delivery_date: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  subtitle: string | null;
  amount_achieved: number;
  external_amount_achieved: number;
  achievement_rate: number;
  external_achievement_rate: number;
  buyers_count: number;
  external_buyers_count: number;
  category_sort_order: number;
  description: string | null;
  link_url: string;
  image_url: string;
  video_url: string | null;
  target_amount: number;
  category_id: string | null;
  creator_description: string | null;
  created_at: string;
  updated_at: string;
  start_date: string;
  end_date: string | null;
  days_remaining: number;
  is_featured: boolean;
  is_public: boolean;
  project_type: 'media' | 'crowdfunding';
  newsletters?: Newsletter[];
}
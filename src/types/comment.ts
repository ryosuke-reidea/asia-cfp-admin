export interface ProjectComment {
  id: string;
  project_id: string;
  commenter_name: string;
  commenter_email: string;
  comment_text: string;
  rating: number | null;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}
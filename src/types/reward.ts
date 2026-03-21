export interface RewardVariant {
  size?: string;
  color?: string;
  stock: number;
  sku?: string;
}

export interface Reward {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  price: number;
  estimated_delivery: string | null;
  quantity_available: number | null;
  quantity_claimed: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  link_url: string | null;
  variants: RewardVariant[];
  created_at: string;
  updated_at: string;
}
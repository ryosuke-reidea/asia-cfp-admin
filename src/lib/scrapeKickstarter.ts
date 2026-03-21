export interface KickstarterReward {
  title: string;
  description: string;
  price: number;
  estimatedDelivery: string;
  imageUrl?: string;
  quantityAvailable?: number;
  backersCount: number;
}
export interface KickstarterData {
  title: string;
  subtitle: string;
  imageUrl: string;
  targetAmount: number;
  currentAmount: number;
  backersCount: number;
  category: string;
  description: string;
  creatorDescription: string;
  videoUrl?: string;
  rewards?: KickstarterReward[];
}
export async function scrapeKickstarter(url: string): Promise<{ success: boolean; data?: KickstarterData; error?: string }> {
  try {
    // Validate URL format
    if (!url.trim()) {
      throw new Error('URLが入力されていません');
    }
    if (!url.includes('kickstarter.com/projects/')) {
      throw new Error('有効なKickstarterプロジェクトURLを入力してください（例: https://www.kickstarter.com/projects/...）');
    }
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-kickstarter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error occurred' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    
    // Validate response data
    if (!result.success || !result.data) {
      throw new Error(result.error || 'スクレイピングに失敗しました');
    }
    // Validate essential data fields
    const data = result.data;
    if (!data.title || data.title === 'Untitled Project') {
      console.warn('プロジェクトタイトルを正しく取得できませんでした');
    }
    if (data.targetAmount === 0) {
      console.warn('目標金額を取得できませんでした');
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error scraping Kickstarter:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '不明なエラーが発生しました' 
    };
  }
}
export interface KickstarterStats {
  targetAmount: number;
  currentAmount: number;
  backersCount: number;
  startDate?: string;
  endDate?: string;
}

export async function updateKickstarterStats(
  projectId: string,
  kickstarterUrl: string
): Promise<{ success: boolean; data?: KickstarterStats; error?: string }> {
  try {
    // Vercel Serverless Function (Puppeteer) を使用してKickstarterの最新データを取得
    const response = await fetch('/api/scrape-kickstarter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: kickstarterUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error occurred' }));
      throw new Error(errorData.error || `API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch Kickstarter stats');
    }

    const stats: KickstarterStats = {
      targetAmount: result.data.targetAmount || 0,
      currentAmount: result.data.currentAmount || 0,
      backersCount: result.data.backersCount || 0,
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error updating Kickstarter stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function updateProjectWithKickstarterStats(
  projectId: string,
  stats: KickstarterStats
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await import('./supabase');
    
    // 達成率を計算
    const achievementRate = stats.targetAmount > 0 
      ? Math.round((stats.currentAmount / stats.targetAmount) * 100)
      : 0;

    const updateData: any = {
      target_amount: stats.targetAmount,
      external_amount_achieved: stats.currentAmount,
      external_buyers_count: stats.backersCount,
      external_achievement_rate: achievementRate,
      updated_at: new Date().toISOString(),
    };

    // 日付データがある場合は更新
    if (stats.startDate) {
      updateData.start_date = stats.startDate;
    }
    if (stats.endDate) {
      updateData.end_date = stats.endDate;
    }

    const { error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating project with Kickstarter stats:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Database update failed' 
    };
  }
}
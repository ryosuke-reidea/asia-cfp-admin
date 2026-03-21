import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { updateKickstarterStats, updateProjectWithKickstarterStats } from '../lib/updateKickstarterStats';

interface UseKickstarterAutoUpdateOptions {
  projectId: string;
  kickstarterUrl: string;
  intervalMinutes?: number;
  enabled?: boolean;
  onUpdate?: () => void;
}

export function useKickstarterAutoUpdate({
  projectId,
  kickstarterUrl,
  intervalMinutes = 30, // デフォルト30分間隔
  enabled = false,
  onUpdate
}: UseKickstarterAutoUpdateOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !kickstarterUrl || !kickstarterUrl.includes('kickstarter.com')) {
      return;
    }

    const updateStats = async () => {
      try {
        const statsResult = await updateKickstarterStats(projectId, kickstarterUrl);
        
        if (statsResult.success && statsResult.data) {
          const updateResult = await updateProjectWithKickstarterStats(projectId, statsResult.data);
          
          if (updateResult.success) {
            console.log('Kickstarter stats auto-updated for project:', projectId);
            if (onUpdate) {
              onUpdate();
            }
          }
        }
      } catch (error) {
        console.error('Auto-update failed:', error);
      }
    };

    // 初回実行
    updateStats();

    // 定期実行を設定
    intervalRef.current = setInterval(updateStats, intervalMinutes * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, kickstarterUrl, intervalMinutes, enabled, onUpdate]);

  const stopAutoUpdate = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startAutoUpdate = () => {
    if (!intervalRef.current && enabled && kickstarterUrl?.includes('kickstarter.com')) {
      const updateStats = async () => {
        try {
          const statsResult = await updateKickstarterStats(projectId, kickstarterUrl);
          
          if (statsResult.success && statsResult.data) {
            const updateResult = await updateProjectWithKickstarterStats(projectId, statsResult.data);
            
            if (updateResult.success && onUpdate) {
              onUpdate();
            }
          }
        } catch (error) {
          console.error('Auto-update failed:', error);
        }
      };

      intervalRef.current = setInterval(updateStats, intervalMinutes * 60 * 1000);
    }
  };

  return {
    stopAutoUpdate,
    startAutoUpdate,
    isRunning: intervalRef.current !== null
  };
}
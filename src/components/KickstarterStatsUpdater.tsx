import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { RefreshCw, TrendingUp, Users, Target, Calendar } from 'lucide-react';
import { updateKickstarterStats, updateProjectWithKickstarterStats } from '../lib/updateKickstarterStats';
import AutoUpdateSettings from './AutoUpdateSettings';
import { useKickstarterAutoUpdate } from '../hooks/useKickstarterAutoUpdate';

interface KickstarterStatsUpdaterProps {
  projectId: string;
  kickstarterUrl: string;
  onUpdate?: () => void;
  className?: string;
}

export default function KickstarterStatsUpdater({ 
  projectId, 
  kickstarterUrl, 
  onUpdate,
  className = '' 
}: KickstarterStatsUpdaterProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [autoUpdateInterval, setAutoUpdateInterval] = useState(30);

  // 自動更新フック
  const { stopAutoUpdate, startAutoUpdate, isRunning } = useKickstarterAutoUpdate({
    projectId,
    kickstarterUrl,
    intervalMinutes: autoUpdateInterval,
    enabled: autoUpdateEnabled,
    onUpdate: () => {
      setLastUpdated(new Date());
      if (onUpdate) {
        onUpdate();
      }
    }
  });

  const handleUpdateStats = async () => {
    if (!kickstarterUrl || !kickstarterUrl.includes('kickstarter.com')) {
      toast.error('有効なKickstarter URLが設定されていません');
      return;
    }

    setIsUpdating(true);
    try {
      // Kickstarterから最新データを取得
      const statsResult = await updateKickstarterStats(projectId, kickstarterUrl);
      
      if (!statsResult.success || !statsResult.data) {
        throw new Error(statsResult.error || 'データの取得に失敗しました');
      }

      // データベースを更新
      const updateResult = await updateProjectWithKickstarterStats(projectId, statsResult.data);
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'データベースの更新に失敗しました');
      }

      setStats(statsResult.data);
      setLastUpdated(new Date());
      toast.success('Kickstarterデータを更新しました');
      
      // 親コンポーネントに更新を通知
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating Kickstarter stats:', error);
      toast.error(error instanceof Error ? error.message : 'データの更新に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAutoUpdateSettingsChange = (enabled: boolean, interval: number) => {
    setAutoUpdateEnabled(enabled);
    setAutoUpdateInterval(interval);
    
    if (enabled) {
      startAutoUpdate();
    } else {
      stopAutoUpdate();
    }
  };
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
          Kickstarter リアルタイム更新
        </h3>
        <button
          onClick={handleUpdateStats}
          disabled={isUpdating}
          className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
            isUpdating 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700'
          } transition-colors`}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? '更新中...' : '今すぐ更新'}
        </button>
      </div>

      {lastUpdated && (
        <div className="text-sm text-gray-500 mb-4">
          最終更新: {lastUpdated.toLocaleString('ja-JP')}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center">
              <Target className="w-4 h-4 text-blue-600 mr-2" />
              <div className="text-xs text-blue-600 font-medium">目標金額</div>
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1">
              ¥{stats.targetAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center">
              <TrendingUp className="w-4 h-4 text-green-600 mr-2" />
              <div className="text-xs text-green-600 font-medium">達成金額</div>
            </div>
            <div className="text-lg font-bold text-green-900 mt-1">
              ¥{stats.currentAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="flex items-center">
              <Users className="w-4 h-4 text-purple-600 mr-2" />
              <div className="text-xs text-purple-600 font-medium">購入者数</div>
            </div>
            <div className="text-lg font-bold text-purple-900 mt-1">
              {stats.backersCount.toLocaleString()}人
            </div>
          </div>

          <div className="bg-orange-50 p-3 rounded-lg">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 text-orange-600 mr-2" />
              <div className="text-xs text-orange-600 font-medium">達成率</div>
            </div>
            <div className="text-lg font-bold text-orange-900 mt-1">
              {stats.targetAmount > 0 
                ? Math.round((stats.currentAmount / stats.targetAmount) * 100)
                : 0}%
            </div>
          </div>
        </div>
      )}

      {stats && (stats.startDate || stats.endDate) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {stats.startDate && (
              <div>
                <span className="text-gray-500">開始日:</span>
                <span className="ml-2 font-medium">{stats.startDate}</span>
              </div>
            )}
            {stats.endDate && (
              <div>
                <span className="text-gray-500">終了日:</span>
                <span className="ml-2 font-medium">{stats.endDate}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <p>※ Kickstarterから最新のデータを取得してプロジェクト情報を自動更新します</p>
        <p>※ 目標金額、達成金額、購入者数、達成率が自動的に更新されます</p>
      </div>

      <div className="mt-4">
        <AutoUpdateSettings
          projectId={projectId}
          kickstarterUrl={kickstarterUrl}
          onSettingsChange={handleAutoUpdateSettingsChange}
        />
      </div>
    </div>
  );
}
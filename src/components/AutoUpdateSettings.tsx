import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AutoUpdateSettingsProps {
  projectId: string;
  kickstarterUrl: string;
  onSettingsChange?: (enabled: boolean, interval: number) => void;
}

export default function AutoUpdateSettings({ 
  projectId, 
  kickstarterUrl, 
  onSettingsChange 
}: AutoUpdateSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // ローカルストレージから設定を読み込み
    const savedSettings = localStorage.getItem(`auto-update-${projectId}`);
    if (savedSettings) {
      const { enabled, interval } = JSON.parse(savedSettings);
      setIsEnabled(enabled);
      setIntervalMinutes(interval);
    }
  }, [projectId]);

  const handleToggleAutoUpdate = () => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    
    // 設定をローカルストレージに保存
    localStorage.setItem(`auto-update-${projectId}`, JSON.stringify({
      enabled: newEnabled,
      interval: intervalMinutes
    }));

    if (onSettingsChange) {
      onSettingsChange(newEnabled, intervalMinutes);
    }

    toast.success(newEnabled ? '自動更新を開始しました' : '自動更新を停止しました');
  };

  const handleIntervalChange = (newInterval: number) => {
    setIntervalMinutes(newInterval);
    
    // 設定をローカルストレージに保存
    localStorage.setItem(`auto-update-${projectId}`, JSON.stringify({
      enabled: isEnabled,
      interval: newInterval
    }));

    if (onSettingsChange) {
      onSettingsChange(isEnabled, newInterval);
    }

    toast.success(`更新間隔を${newInterval}分に変更しました`);
  };

  if (!kickstarterUrl || !kickstarterUrl.includes('kickstarter.com')) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-gray-600" />
          自動更新設定
        </h4>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-gray-400 hover:text-gray-600"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={handleToggleAutoUpdate}
            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isEnabled
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {isEnabled ? (
              <>
                <Pause className="w-3 h-3 mr-1" />
                自動更新中
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                自動更新停止中
              </>
            )}
          </button>
          {isEnabled && (
            <span className="ml-3 text-xs text-gray-500">
              {intervalMinutes}分間隔で更新
            </span>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            更新間隔（分）
          </label>
          <div className="flex gap-2">
            {[15, 30, 60, 120].map((interval) => (
              <button
                key={interval}
                onClick={() => handleIntervalChange(interval)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  intervalMinutes === interval
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {interval}分
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ※ 頻繁な更新はKickstarterサーバーに負荷をかける可能性があります
          </p>
        </div>
      )}
    </div>
  );
}
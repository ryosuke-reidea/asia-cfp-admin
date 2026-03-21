import React, { useState } from 'react';
import { Reward } from '../types/reward';
import RewardList from './RewardList';
import RewardForm from './RewardForm';

interface RewardManagerProps {
  projectId: string;
}

export default function RewardManager({ projectId }: RewardManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [duplicatingReward, setDuplicatingReward] = useState<Reward | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // プロジェクトIDが無効な場合の処理
  if (!projectId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">リターン管理</h3>
          <p className="text-gray-500">
            プロジェクトを保存してからリターン管理をご利用ください。
          </p>
        </div>
      </div>
    );
  }

  const handleAddReward = () => {
    setEditingReward(null);
    setDuplicatingReward(null);
    setShowForm(true);
  };

  const handleEditReward = (reward: Reward) => {
    setEditingReward(reward);
    setDuplicatingReward(null);
    setShowForm(true);
  };

  const handleDuplicateReward = (reward: Reward) => {
    setEditingReward(null);
    setDuplicatingReward(reward);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingReward(null);
    setDuplicatingReward(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingReward(null);
    setDuplicatingReward(null);
  };

  return (
    <div className="space-y-6">
      <RewardList
        key={refreshKey}
        projectId={projectId}
        onAddReward={handleAddReward}
        onEditReward={handleEditReward}
        onDuplicateReward={handleDuplicateReward}
      />

      {showForm && (
        <RewardForm
          projectId={projectId}
          reward={editingReward}
          duplicateReward={duplicatingReward}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}
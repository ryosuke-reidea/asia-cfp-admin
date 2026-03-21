import React, { useState } from 'react';
import { ProjectComment } from '../types/comment';
import CommentList from './CommentList';
import CommentForm from './CommentForm';
import { Plus } from 'lucide-react';

interface CommentManagerProps {
  projectId: string;
}

export default function CommentManager({ projectId }: CommentManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingComment, setEditingComment] = useState<ProjectComment | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // プロジェクトIDが無効な場合の処理
  if (!projectId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">コメント管理</h3>
          <p className="text-gray-500">
            プロジェクトを保存してからコメント管理をご利用ください。
          </p>
        </div>
      </div>
    );
  }

  const handleAddComment = () => {
    setEditingComment(null);
    setShowForm(true);
  };

  const handleEditComment = (comment: ProjectComment) => {
    setEditingComment(comment);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingComment(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingComment(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">コメント管理</h2>
        <button
          onClick={handleAddComment}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          コメント追加
        </button>
      </div>

      <CommentList
        key={refreshKey}
        projectId={projectId}
        onEditComment={handleEditComment}
      />

      {showForm && (
        <CommentForm
          projectId={projectId}
          comment={editingComment}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}
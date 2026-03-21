import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Save, X, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProjectComment } from '../types/comment';

interface CommentFormProps {
  projectId: string;
  comment?: ProjectComment | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function CommentForm({ projectId, comment, onSave, onCancel }: CommentFormProps) {
  const [formData, setFormData] = useState({
    commenter_name: '',
    comment_text: '',
    is_approved: true,
    is_featured: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (comment) {
      setFormData({
        commenter_name: comment.commenter_name,
        comment_text: comment.comment_text,
        is_approved: comment.is_approved,
        is_featured: comment.is_featured,
      });
    }
  }, [comment]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.commenter_name.trim()) {
      toast.error('投稿者名を入力してください');
      return;
    }

    if (!formData.comment_text.trim()) {
      toast.error('コメント内容を入力してください');
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        project_id: projectId,
        commenter_name: formData.commenter_name.trim(),
        commenter_email: 'anonymous@example.com', // デフォルト値
        comment_text: formData.comment_text.trim(),
        rating: null,
        is_approved: formData.is_approved,
        is_featured: formData.is_featured,
      };

      if (comment) {
        const { error } = await supabase
          .from('project_comments')
          .update(dataToSave)
          .eq('id', comment.id);
        
        if (error) throw error;
        toast.success('コメントを更新しました');
      } else {
        const { error } = await supabase
          .from('project_comments')
          .insert([dataToSave]);
        
        if (error) throw error;
        toast.success('コメントを追加しました');
      }

      onSave();
    } catch (error) {
      console.error('Error saving comment:', error);
      toast.error('コメントの保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {comment ? 'コメントを編集' : '新しいコメントを追加'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="commenter_name" className="block text-sm font-medium text-gray-700">
              投稿者名 *
            </label>
            <input
              type="text"
              id="commenter_name"
              name="commenter_name"
              value={formData.commenter_name}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="山田太郎"
              required
            />
          </div>

          <div>
            <label htmlFor="comment_text" className="block text-sm font-medium text-gray-700">
              コメント内容 *
            </label>
            <div className="mt-1">
              <div className="relative border-2 border-gray-200 rounded-xl overflow-hidden transition-all duration-200 focus-within:border-indigo-400 focus-within:shadow-lg focus-within:shadow-indigo-100">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-150"
                          title="太字"
                        >
                          <strong className="text-sm font-bold">B</strong>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-150"
                          title="斜体"
                        >
                          <em className="text-sm font-medium">I</em>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-150"
                          title="絵文字"
                        >
                          <span className="text-sm">😊</span>
                        </button>
                      </div>
                      <div className="h-6 w-px bg-gray-300"></div>
                      <span className="text-sm text-gray-600 font-medium">コメントを入力</span>
                    </div>
                    <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                      {formData.comment_text.length} 文字
                    </div>
                  </div>
                </div>
                <textarea
                  id="comment_text"
                  name="comment_text"
                  rows={5}
                  value={formData.comment_text}
                  onChange={handleInputChange}
                  className="block w-full border-0 resize-none focus:ring-0 focus:outline-none p-6 text-base placeholder-gray-400 bg-white leading-relaxed"
                  placeholder="商品についてのご感想やコメントをお聞かせください...&#10;&#10;例：&#10;・商品の使い心地はいかがでしたか？&#10;・期待していた通りでしたか？&#10;・他の方におすすめしたいポイントは？"
                  required
                />
                <div className="bg-gradient-to-r from-gray-50 to-indigo-50 px-4 py-3 border-t border-gray-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 flex items-center">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                      正直なご感想をお聞かせください
                    </span>
                    <span className="text-gray-400 bg-white px-2 py-1 rounded-full">Ctrl+Enter で送信</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
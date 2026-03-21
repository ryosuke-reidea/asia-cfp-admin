import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MessageCircle, Star, Eye, EyeOff, Award, Trash2, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProjectComment } from '../types/comment';

interface CommentListProps {
  projectId: string;
  onEditComment?: (comment: ProjectComment) => void;
}

export default function CommentList({ projectId, onEditComment }: CommentListProps) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');

  useEffect(() => {
    fetchComments();
  }, [projectId, filter]);

  const fetchComments = async () => {
    try {
      let query = supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (filter === 'approved') {
        query = query.eq('is_approved', true);
      } else if (filter === 'pending') {
        query = query.eq('is_approved', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('コメントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalToggle = async (comment: ProjectComment) => {
    try {
      const { error } = await supabase
        .from('project_comments')
        .update({ is_approved: !comment.is_approved })
        .eq('id', comment.id);

      if (error) throw error;
      
      toast.success(`コメントを${!comment.is_approved ? '承認' : '非承認'}しました`);
      fetchComments();
    } catch (error) {
      console.error('Error updating comment approval:', error);
      toast.error('承認状態の更新に失敗しました');
    }
  };

  const handleFeaturedToggle = async (comment: ProjectComment) => {
    try {
      const { error } = await supabase
        .from('project_comments')
        .update({ is_featured: !comment.is_featured })
        .eq('id', comment.id);

      if (error) throw error;
      
      toast.success(`コメントを${!comment.is_featured ? '注目コメントに設定' : '注目コメントから解除'}しました`);
      fetchComments();
    } catch (error) {
      console.error('Error updating comment featured status:', error);
      toast.error('注目コメント設定の更新に失敗しました');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('このコメントを削除してもよろしいですか？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('project_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      
      toast.success('コメントを削除しました');
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('コメントの削除に失敗しました');
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <MessageCircle className="w-5 h-5 mr-2 text-indigo-600" />
            購入者コメント ({comments.length})
          </h3>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                filter === 'all'
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                filter === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              承認済み
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                filter === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              承認待ち
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {comments.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">コメントがありません</h4>
            <p className="text-gray-500">
              {filter === 'pending' 
                ? '承認待ちのコメントはありません。'
                : filter === 'approved'
                ? '承認済みのコメントはありません。'
                : 'まだコメントが投稿されていません。'
              }
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{comment.commenter_name}</h4>
                    {comment.is_featured && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Award className="w-3 h-3 mr-1" />
                        注目
                      </span>
                    )}
                    {!comment.is_approved && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        承認待ち
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-2">
                    {comment.commenter_email} • {new Date(comment.created_at).toLocaleDateString('ja-JP')}
                  </div>
                  
                  {comment.rating && (
                    <div className="mb-3">
                      {renderStars(comment.rating)}
                    </div>
                  )}
                  
                  <p className="text-gray-700 mb-3">{comment.comment_text}</p>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleApprovalToggle(comment)}
                    className={`p-2 rounded-md ${
                      comment.is_approved
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                    title={comment.is_approved ? '承認を取り消す' : '承認する'}
                  >
                    {comment.is_approved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => handleFeaturedToggle(comment)}
                    className={`p-2 rounded-md ${
                      comment.is_featured
                        ? 'text-yellow-600 hover:bg-yellow-50'
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                    title={comment.is_featured ? '注目コメントから解除' : '注目コメントに設定'}
                  >
                    <Award className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => onEditComment?.(comment)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
                    title="編集"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
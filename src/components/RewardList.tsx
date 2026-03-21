import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Package, Calendar, Users, DollarSign, ExternalLink, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Reward, RewardVariant } from '../types/reward';

interface RewardListProps {
  projectId: string;
  onAddReward?: () => void;
  onEditReward?: (reward: Reward) => void;
  onDuplicateReward?: (reward: Reward) => void;
}

export default function RewardList({ projectId, onAddReward, onEditReward, onDuplicateReward }: RewardListProps) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewards();
  }, [projectId]);

  const fetchRewards = async () => {
    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      toast.error('リターンの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReward = async (rewardId: string) => {
    if (!window.confirm('このリターンを削除してもよろしいですか？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('rewards')
        .delete()
        .eq('id', rewardId);

      if (error) throw error;
      
      toast.success('リターンを削除しました');
      fetchRewards();
    } catch (error) {
      console.error('Error deleting reward:', error);
      toast.error('リターンの削除に失敗しました');
    }
  };

  const handleToggleAvailability = async (reward: Reward) => {
    try {
      const { error } = await supabase
        .from('rewards')
        .update({ is_available: !reward.is_available })
        .eq('id', reward.id);

      if (error) throw error;
      
      toast.success(`リターンを${!reward.is_available ? '有効' : '無効'}にしました`);
      fetchRewards();
    } catch (error) {
      console.error('Error updating reward availability:', error);
      toast.error('リターンの更新に失敗しました');
    }
  };

  const getTotalVariantStock = (variants: RewardVariant[]): number => {
    if (!variants || variants.length === 0) return 0;
    return variants.reduce((total, variant) => total + variant.stock, 0);
  };

  const formatVariants = (variants: RewardVariant[]): string => {
    if (!variants || variants.length === 0) return '';
    
    const variantStrings = variants.map(variant => {
      const parts = [];
      if (variant.size) parts.push(variant.size);
      if (variant.color) parts.push(variant.color);
      if (parts.length === 0) return `在庫${variant.stock}`;
      return `${parts.join('/')} (${variant.stock})`;
    });
    
    return variantStrings.join(', ');
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
            <Package className="w-5 h-5 mr-2 text-indigo-600" />
            リターン一覧
          </h3>
          <button
            onClick={onAddReward}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            リターン追加
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {rewards.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">リターンがありません</h4>
            <p className="text-gray-500 mb-4">
              プロジェクトのリターンを追加して、支援者に提供する商品やサービスを設定しましょう。
            </p>
            <button
              onClick={onAddReward}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              最初のリターンを追加
            </button>
          </div>
        ) : (
          rewards.map((reward) => (
            <div key={reward.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-lg font-medium text-gray-900">{reward.title}</h4>
                    {!reward.is_available && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        無効
                      </span>
                    )}
                    {reward.quantity_available && reward.quantity_claimed >= reward.quantity_available && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        完売
                      </span>
                    )}
                  </div>
                  
                  {reward.description && (
                    <p className="text-gray-600 mb-3">{reward.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="flex items-center text-sm text-gray-500">
                      <DollarSign className="w-4 h-4 mr-1" />
                      ¥{reward.price.toLocaleString()}
                    </div>
                    
                    {reward.estimated_delivery && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        {reward.estimated_delivery}
                      </div>
                    )}
                    
                    {reward.quantity_available && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="w-4 h-4 mr-1" />
                        残り{reward.quantity_available - reward.quantity_claimed}個
                      </div>
                    )}
                    
                    {reward.variants && reward.variants.length > 0 && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Package className="w-4 h-4 mr-1" />
                        バリエーション在庫: {getTotalVariantStock(reward.variants)}個
                      </div>
                    )}
                    
                    <div className="flex items-center text-sm text-gray-500">
                      <Package className="w-4 h-4 mr-1" />
                      {reward.quantity_claimed}人が選択
                    </div>
                    
                    {reward.link_url && (
                      <div className="flex items-center text-sm">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        <a
                          href={reward.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline truncate max-w-32"
                        >
                          専用リンク
                        </a>
                      </div>
                    )}
                  </div>

                  {reward.variants && reward.variants.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">バリエーション:</h5>
                      <div className="text-sm text-gray-600">
                        {formatVariants(reward.variants)}
                      </div>
                    </div>
                  )}

                  {reward.image_url && (
                    <div className="mb-3">
                      <img
                        src={reward.image_url}
                        alt={reward.title}
                        className="w-32 h-24 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleToggleAvailability(reward)}
                    className={`px-3 py-1 text-xs font-medium rounded-md ${
                      reward.is_available
                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {reward.is_available ? '無効化' : '有効化'}
                  </button>
                  
                  <button
                    onClick={() => onDuplicateReward?.(reward)}
                    className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded-md transition-colors"
                    title="複製"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => onEditReward?.(reward)}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="編集"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteReward(reward.id)}
                    className="text-red-600 hover:text-red-900"
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
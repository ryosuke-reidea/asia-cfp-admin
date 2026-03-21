import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CreditCard, Users, Package, Calendar, Mail, MapPin, Phone, Filter, ChevronDown, ChevronUp, DollarSign, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Reward, RewardVariant } from '../types/reward';

import PaymentProcessingModal from './PaymentProcessingModal';
import BatchPaymentModal from './BatchPaymentModal';
interface Reservation {
  id: string;
  user_id: string;
  project_id: string;
  reward_id: string | null;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  amount: number;
  currency: string;
  shipping_address: {
  fullName: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
  status: string;
  created_at: string;
  updated_at: string;
  setup_intent_id: string | null;
}

interface PaymentManagerProps {
  projectId: string;
}

export default function PaymentManager({ projectId }: PaymentManagerProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedReward, setExpandedReward] = useState<string | null>(null);
  const [rewardReservations, setRewardReservations] = useState<{[key: string]: Reservation[]}>({});

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showBatchPaymentModal, setShowBatchPaymentModal] = useState(false);
  
  useEffect(() => {
    if (projectId) {
      fetchReservations();
      fetchRewards();
    }
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
    }
  };

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReservations(data || []);
      
      // リターン別に予約をグループ化
      const groupedReservations: {[key: string]: Reservation[]} = {};
      (data || []).forEach(reservation => {
        const key = reservation.reward_id || 'none';
        if (!groupedReservations[key]) {
          groupedReservations[key] = [];
        }
        groupedReservations[key].push(reservation);
      });
      setRewardReservations(groupedReservations);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error('予約情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getRewardTitle = (rewardId: string | null) => {
    if (!rewardId) return '支援のみ';
    const reward = rewards.find(r => r.id === rewardId);
    return reward ? reward.title : '不明なリターン';
  };

  const getTotalVariantStock = (variants: RewardVariant[]): number => {
    if (!variants || variants.length === 0) return 0;
    return variants.reduce((total, variant) => total + variant.stock, 0);
  };
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '保留中', color: 'bg-yellow-100 text-yellow-800' },
      confirmed: { label: '確認済み', color: 'bg-blue-100 text-blue-800' },
      charged: { label: '決済完了', color: 'bg-green-100 text-green-800' },
      shipped: { label: '発送済み', color: 'bg-purple-100 text-purple-800' },
      completed: { label: '完了', color: 'bg-gray-100 text-gray-800' },
      cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleChargeReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowPaymentModal(true);
  };

  const getRewardStats = () => {
    const stats = rewards.map(reward => {
      const rewardReservationsList = rewardReservations[reward.id] || [];
      const confirmedReservations = rewardReservationsList.filter(r => 
        ['confirmed', 'charged', 'shipped', 'completed'].includes(r.status)
      );
      
      const variantStock = getTotalVariantStock(reward.variants || []);
      
      return {
        reward,
        reservationCount: rewardReservationsList.length,
        confirmedCount: confirmedReservations.length,
        totalAmount: confirmedReservations.reduce((sum, r) => sum + r.amount, 0),
        variantStock
      };
    });

    return stats;
  };

  const filteredReservations = reservations.filter(reservation => {
    if (selectedReward !== 'all') {
      if (selectedReward === 'none' && reservation.reward_id !== null) return false;
      if (selectedReward !== 'none' && reservation.reward_id !== selectedReward) return false;
    }
    
    if (statusFilter !== 'all' && reservation.status !== statusFilter) return false;
    
    return true;
  });

  const handlePaymentSuccess = () => {
    fetchReservations();
  };

  const handleBatchPayment = () => {
    setShowBatchPaymentModal(true);
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

  const rewardStats = getRewardStats();

  return (
    <div className="space-y-6">
      {/* 統計サマリー */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
          <CreditCard className="w-5 h-5 mr-2 text-indigo-600" />
          決済統計
          <div className="ml-auto">
            <button
              onClick={handleBatchPayment}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              まとめて決済実行
            </button>
          </div>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-2" />
              <div className="text-sm text-blue-600 font-medium">総予約数</div>
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {reservations.filter(r => r.status !== 'cancelled').length}件
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CreditCard className="w-5 h-5 text-green-600 mr-2" />
              <div className="text-sm text-green-600 font-medium">総売上</div>
            </div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              ${reservations.filter(r => r.status !== 'cancelled').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Package className="w-5 h-5 text-purple-600 mr-2" />
              <div className="text-sm text-purple-600 font-medium">確定済み</div>
            </div>
            <div className="text-2xl font-bold text-purple-900 mt-1">
              {reservations.filter(r => ['confirmed', 'charged', 'shipped', 'completed'].includes(r.status)).length}件
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-orange-600 mr-2" />
              <div className="text-sm text-orange-600 font-medium">保留中</div>
            </div>
            <div className="text-2xl font-bold text-orange-900 mt-1">
              {reservations.filter(r => r.status === 'pending').length}件
            </div>
          </div>
        </div>
      </div>

      {/* リターン別統計と予約者一覧 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
          <Package className="w-5 h-5 mr-2 text-indigo-600" />
          リターン別売上と予約者一覧
        </h3>
        
        <div className="space-y-3">
          {rewardStats.map((stat) => (
            <div key={stat.reward.id} className="border border-gray-200 rounded-lg">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedReward(expandedReward === stat.reward.id ? null : stat.reward.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{stat.reward.title}</h4>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {stat.reservationCount}件の予約
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    ${stat.reward.price?.toLocaleString() || 0} × {stat.confirmedCount}件確定
                    {stat.variantStock > 0 && (
                      <span className="ml-2 text-xs text-blue-600">
                        (バリエーション在庫: {stat.variantStock})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${stat.totalAmount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      総売上
                    </div>
                  </div>
                  {expandedReward === stat.reward.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
              
              {expandedReward === stat.reward.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h5 className="font-medium text-gray-900 mb-3">予約者一覧</h5>
                  {rewardReservations[stat.reward.id] && rewardReservations[stat.reward.id].length > 0 ? (
                    <div className="space-y-3">
                      {rewardReservations[stat.reward.id].map((reservation) => (
                        <div key={reservation.id} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center text-gray-500 mb-1">
                                  <Mail className="w-3 h-3 mr-1" />
                                  連絡先
                                </div>
                                <div className="text-gray-900 text-xs">
                                  {reservation.shipping_address.name}
                                </div>
                                <div className="text-gray-500 text-xs">
                                  {reservation.shipping_address.email}
                                </div>
                                {reservation.shipping_address.phone && (
                                  <div className="text-gray-500 text-xs">
                                    {reservation.shipping_address.phone}
                                  </div>
                                )}
                                {getStatusBadge(reservation.status)}
                                {(reservation.status === 'confirmed' || reservation.status === 'pending' || reservation.status === 'reserved') && (
                                  <button
                                    onClick={() => handleChargeReservation(reservation)}
                                    className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-md transition-colors bg-green-100 text-green-800 hover:bg-green-200"
                                  >
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    決済実行
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <div className="flex items-center text-gray-500 mb-1">
                                    <CreditCard className="w-3 h-3 mr-1" />
                                    決済情報
                                  </div>
                                  <div className="text-gray-900 text-xs">
                                    ${reservation.amount.toLocaleString()}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {new Date(reservation.created_at).toLocaleDateString('ja-JP')}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center text-gray-500 mb-1">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    配送先
                                  </div>
                                  <div className="text-gray-900 text-xs leading-relaxed">
                                  {reservation.shipping_address.address}<br />
                                  {reservation.shipping_address.city}, {reservation.shipping_address.state} {reservation.shipping_address.postalCode}<br />
                                  {reservation.shipping_address.country}
                                </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="ml-4">
                              <select
                                value={reservation.status}
                                onChange={async (e) => {
                                  try {
                                    const { error } = await supabase
                                      .from('reservations')
                                      .update({ status: e.target.value })
                                      .eq('id', reservation.id);
                                    
                                    if (error) throw error;
                                    toast.success('ステータスを更新しました');
                                    fetchReservations();
                                  } catch (error) {
                                    console.error('Error updating status:', error);
                                    toast.error('ステータスの更新に失敗しました');
                                  }
                                }}
                                className="text-xs border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="pending">保留中</option>
                                <option value="confirmed">確認済み</option>
                                <option value="charged">決済完了</option>
                                <option value="shipped">発送済み</option>
                                <option value="completed">完了</option>
                                <option value="cancelled">キャンセル</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="text-xs text-gray-500">
                              予約ID: {reservation.id.substring(0, 8)}...
                              {reservation.setup_intent_id && (
                                <span className="ml-2">
                                  Setup Intent: {reservation.setup_intent_id.substring(0, 12)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">このリターンの予約はありません。</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">全予約・購入者一覧</h3>
        </div>
        
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">リターン</label>
            <select
              value={selectedReward}
              onChange={(e) => setSelectedReward(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="all">すべてのリターン</option>
              <option value="none">支援のみ</option>
              {rewards.map((reward) => (
                <option key={reward.id} value={reward.id}>
                  {reward.title} (${reward.price.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="all">すべてのステータス</option>
              <option value="pending">保留中</option>
              <option value="confirmed">確認済み</option>
              <option value="charged">決済完了</option>
              <option value="shipped">発送済み</option>
              <option value="completed">完了</option>
              <option value="cancelled">キャンセル</option>
            </select>
          </div>
        </div>

        {/* 予約一覧 */}
        <div className="overflow-hidden">
          {filteredReservations.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">予約がありません</h4>
              <p className="text-gray-500">
                {selectedReward !== 'all' || statusFilter !== 'all' 
                  ? '選択した条件に一致する予約がありません。'
                  : 'まだ予約・購入がありません。'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((reservation) => (
                <div key={reservation.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900">
                          {getRewardTitle(reservation.reward_id)}
                        </h4>
                        {getStatusBadge(reservation.status)}
                        {(reservation.status === 'confirmed' || reservation.status === 'pending' || reservation.status === 'reserved') && (
                          <button
                            onClick={() => handleChargeReservation(reservation)}
                            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md transition-colors bg-green-100 text-green-800 hover:bg-green-200"
                          >
                            <DollarSign className="w-3 h-3 mr-1" />
                            決済実行
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="flex items-center text-gray-500 mb-1">
                            <CreditCard className="w-4 h-4 mr-1" />
                            決済情報
                          </div>
                          <div className="text-gray-900">
                            ${reservation.amount.toLocaleString()} ({reservation.currency})
                          </div>
                          <div className="text-gray-500 text-xs">
                            {new Date(reservation.created_at).toLocaleDateString('ja-JP')}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center text-gray-500 mb-1">
                            <Mail className="w-4 h-4 mr-1" />
                            連絡先
                          </div>
                          <div className="text-gray-900 text-xs">
                          {reservation.shipping_address.fullName}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {reservation.shipping_address.email}
                        </div>
                        {reservation.shipping_address.phone && (
                          <div className="text-gray-500 text-xs">
                            {reservation.shipping_address.phone}
                          </div>
                        )}
                        </div>

                        <div>
                          <div className="flex items-center text-gray-500 mb-1">
                            <MapPin className="w-4 h-4 mr-1" />
                            配送先住所
                          </div>
                          <div className="text-gray-900 text-xs leading-relaxed">
                          {reservation.shipping_address.address}<br />
                          {reservation.shipping_address.city}, {reservation.shipping_address.state} {reservation.shipping_address.postalCode}<br />
                          {reservation.shipping_address.country}
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      予約ID: {reservation.id.substring(0, 8)}...
                      {reservation.setup_intent_id && (
                        <span className="ml-2">
                          Setup Intent: {reservation.setup_intent_id.substring(0, 12)}...
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <select
                        value={reservation.status}
                        onChange={async (e) => {
                          try {
                            const { error } = await supabase
                              .from('reservations')
                              .update({ status: e.target.value })
                              .eq('id', reservation.id);
                            
                            if (error) throw error;
                            toast.success('ステータスを更新しました');
                            fetchReservations();
                          } catch (error) {
                            console.error('Error updating status:', error);
                            toast.error('ステータスの更新に失敗しました');
                          }
                        }}
                        className="text-xs border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="pending">保留中</option>
                        <option value="confirmed">確認済み</option>
                        <option value="charged">決済完了</option>
                        <option value="shipped">発送済み</option>
                        <option value="completed">完了</option>
                        <option value="cancelled">キャンセル</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 決済処理モーダル */}
      {showPaymentModal && selectedReservation && (
        <PaymentProcessingModal
          reservation={selectedReservation}
          rewardTitle={getRewardTitle(selectedReservation.reward_id)}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedReservation(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* まとめて決済処理モーダル */}
      {showBatchPaymentModal && (
        <BatchPaymentModal
          projectId={projectId}
          reservations={reservations}
          getRewardTitle={getRewardTitle}
          onClose={() => setShowBatchPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
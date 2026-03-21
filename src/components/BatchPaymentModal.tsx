import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, DollarSign, AlertTriangle, CheckCircle, Users, Package } from 'lucide-react';
import { processPayment } from '../lib/processPayment';

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
    name: string;
    email: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  status: string;
  created_at: string;
  updated_at: string;
  setup_intent_id: string | null;
}

interface BatchPaymentModalProps {
  projectId: string;
  reservations: Reservation[];
  getRewardTitle: (rewardId: string | null) => string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchPaymentModal({
  projectId,
  reservations,
  getRewardTitle,
  onClose,
  onSuccess,
}: BatchPaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedReservations, setSelectedReservations] = useState<string[]>([]);
  const [processedResults, setProcessedResults] = useState<{[key: string]: { success: boolean; error?: string }}>({});
  const [showResults, setShowResults] = useState(false);

  // 決済可能な予約のみをフィルタリング（現在のプロジェクトのみ）
  const eligibleReservations = reservations.filter(r => 
    r.project_id === projectId && 
    (r.status === 'confirmed' || r.status === 'pending' || r.status === 'reserved')
  );

  const handleSelectAll = () => {
    if (selectedReservations.length === eligibleReservations.length) {
      setSelectedReservations([]);
    } else {
      setSelectedReservations(eligibleReservations.map(r => r.id));
    }
  };

  const handleSelectReservation = (reservationId: string) => {
    setSelectedReservations(prev => 
      prev.includes(reservationId)
        ? prev.filter(id => id !== reservationId)
        : [...prev, reservationId]
    );
  };

  const handleBatchPayment = async () => {
    if (selectedReservations.length === 0) {
      toast.error('決済する予約を選択してください');
      return;
    }

    setIsProcessing(true);
    setProcessedResults({});
    
    const results: {[key: string]: { success: boolean; error?: string }} = {};
    let successCount = 0;
    let failureCount = 0;

    try {
      // 選択された予約を順次処理
      for (const reservationId of selectedReservations) {
        const reservation = eligibleReservations.find(r => r.id === reservationId);
        if (!reservation) continue;

        try {
          const result = await processPayment(reservationId);
          
          if (result.success) {
            results[reservationId] = { success: true };
            successCount++;
          } else {
            results[reservationId] = { success: false, error: result.error };
            failureCount++;
          }
        } catch (error) {
          results[reservationId] = { 
            success: false, 
            error: error instanceof Error ? error.message : '決済処理に失敗しました' 
          };
          failureCount++;
        }

        // 結果を随時更新
        setProcessedResults({...results});
        
        // APIレート制限を避けるため少し待機
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 結果をトースト表示
      if (successCount > 0 && failureCount === 0) {
        toast.success(`${successCount}件の決済が完了しました`);
      } else if (successCount > 0 && failureCount > 0) {
        toast.success(`${successCount}件成功、${failureCount}件失敗しました`);
      } else {
        toast.error(`すべての決済が失敗しました（${failureCount}件）`);
      }

      setShowResults(true);
      
      if (successCount > 0) {
        onSuccess();
      }
    } catch (error) {
      console.error('Batch payment error:', error);
      toast.error('まとめて決済処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalAmount = eligibleReservations
    .filter(r => selectedReservations.includes(r.id))
    .reduce((sum, r) => sum + r.amount, 0);

  const groupedByReward = eligibleReservations.reduce((groups, reservation) => {
    const key = reservation.reward_id || 'none';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(reservation);
    return groups;
  }, {} as {[key: string]: Reservation[]});

  if (showResults) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              決済処理結果
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedReservations.map(reservationId => {
              const reservation = eligibleReservations.find(r => r.id === reservationId);
              const result = processedResults[reservationId];
              
              if (!reservation) return null;

              return (
                <div key={reservationId} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {reservation.shipping_address.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getRewardTitle(reservation.reward_id)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          ${reservation.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {reservation.shipping_address.email}
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {result ? (
                        result.success ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            成功
                          </span>
                        ) : (
                          <div className="text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              失敗
                            </span>
                            {result.error && (
                              <div className="text-xs text-red-600 mt-1 max-w-48 truncate" title={result.error}>
                                {result.error}
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          処理中...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            まとめて決済実行
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isProcessing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 警告メッセージ */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">まとめて決済処理の実行</p>
              <p>選択した予約に対して実際の決済処理が行われます。処理後の取り消しはできません。</p>
              <p className="mt-1 font-medium">※ このプロジェクトの予約のみが対象となります</p>
            </div>
          </div>
        </div>

        {/* 統計情報 */}
        <div className="bg-gray-50 rounded-md p-4 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{eligibleReservations.length}</div>
              <div className="text-sm text-gray-500">決済可能な予約</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-900">{selectedReservations.length}</div>
              <div className="text-sm text-gray-500">選択中</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900">${totalAmount.toLocaleString()}</div>
              <div className="text-sm text-gray-500">選択した予約の合計金額</div>
            </div>
          </div>
        </div>

        {eligibleReservations.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">決済可能な予約がありません</h4>
            <p className="text-gray-500">
              「確認済み」、「保留中」、または「予約済み」ステータスの予約がありません。
            </p>
          </div>
        ) : (
          <>
            {/* 全選択チェックボックス */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedReservations.length === eligibleReservations.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  disabled={isProcessing}
                />
                <span className="ml-2 text-sm font-medium text-gray-900">
                  すべて選択 ({eligibleReservations.length}件)
                </span>
              </label>
            </div>

            {/* リターン別グループ表示 */}
            <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
              {Object.entries(groupedByReward).map(([rewardId, reservations]) => (
                <div key={rewardId} className="border border-gray-200 rounded-lg">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900 flex items-center">
                      <Package className="w-4 h-4 mr-2 text-gray-600" />
                      {getRewardTitle(rewardId === 'none' ? null : rewardId)}
                      <span className="ml-2 text-sm text-gray-500">
                        ({reservations.length}件)
                      </span>
                    </h4>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    {reservations.map((reservation) => (
                      <div key={reservation.id} className="flex items-center justify-between">
                        <label className="flex items-center flex-1">
                          <input
                            type="checkbox"
                            checked={selectedReservations.includes(reservation.id)}
                            onChange={() => handleSelectReservation(reservation.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            disabled={isProcessing}
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {reservation.shipping_address.name}
                              </span>
                              <span className="text-sm text-gray-500">
                                {reservation.shipping_address.email}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {reservation.status === 'confirmed' ? '確認済み' : '保留中'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              予約日: {new Date(reservation.created_at).toLocaleDateString('ja-JP')}
                            </div>
                          </div>
                        </label>
                        
                        <div className="ml-4 text-right">
                          <div className="font-medium text-gray-900">
                            ${reservation.amount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleBatchPayment}
            disabled={isProcessing || selectedReservations.length === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                決済処理中... ({Object.keys(processedResults).length}/{selectedReservations.length})
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                選択した{selectedReservations.length}件を決済実行
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
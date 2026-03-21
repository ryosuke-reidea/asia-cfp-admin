import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
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

interface PaymentProcessingModalProps {
  reservation: Reservation;
  rewardTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentProcessingModal({
  reservation,
  rewardTitle,
  onClose,
  onSuccess,
}: PaymentProcessingModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [customAmount, setCustomAmount] = useState(reservation.amount);
  const [useCustomAmount, setUseCustomAmount] = useState(false);

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    
    try {
      const paymentAmount = useCustomAmount ? customAmount : reservation.amount;
      
      if (paymentAmount <= 0) {
        throw new Error('決済金額は0円より大きい必要があります');
      }

      const result = await processPayment(
        reservation.id,
        useCustomAmount ? customAmount : undefined
      );
      
      if (result.success) {
        toast.success(`決済が完了しました (PaymentIntent: ${result.paymentIntentId})`);
        onSuccess();
        onClose();
      } else {
        throw new Error(result.error || '決済処理に失敗しました');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      toast.error(error instanceof Error ? error.message : '決済処理に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            決済処理の確認
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isProcessing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 警告メッセージ */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">決済処理の実行</p>
                <p>この操作により、顧客のクレジットカードから実際に決済が行われます。処理後の取り消しはできません。</p>
              </div>
            </div>
          </div>

          {/* 予約情報 */}
          <div className="bg-gray-50 rounded-md p-4">
            <h4 className="font-medium text-gray-900 mb-2">予約情報</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">予約者:</span>
                <span className="font-medium">{reservation.shipping_address.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">メール:</span>
                <span className="font-medium">{reservation.shipping_address.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">リターン:</span>
                <span className="font-medium">{rewardTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">予約金額:</span>
                <span className="font-medium">${reservation.amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 決済金額設定 */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useCustomAmount"
                checked={useCustomAmount}
                onChange={(e) => setUseCustomAmount(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={isProcessing}
              />
              <label htmlFor="useCustomAmount" className="ml-2 block text-sm text-gray-900">
                カスタム金額で決済
              </label>
            </div>

            {useCustomAmount && (
              <div>
                <label htmlFor="customAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  決済金額 (円)
                </label>
                <input
                  type="number"
                  id="customAmount"
                  min="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  disabled={isProcessing}
                />
              </div>
            )}
          </div>

          {/* 決済金額表示 */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-indigo-800">決済予定金額:</span>
              <span className="text-lg font-bold text-indigo-900">
                ${(useCustomAmount ? customAmount : reservation.amount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleProcessPayment}
            disabled={isProcessing || (useCustomAmount && customAmount <= 0)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                決済処理中...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                決済を実行
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
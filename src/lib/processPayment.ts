export interface ProcessPaymentRequest {
  reservationId: string;
  amount?: number;
}

export interface ProcessPaymentResponse {
  success: boolean;
  paymentIntentId?: string;
  status?: string;
  error?: string;
}

export async function processPayment(
  reservationId: string,
  amount?: number
): Promise<ProcessPaymentResponse> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          reservationId,
          amount,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '決済処理に失敗しました',
    };
  }
}
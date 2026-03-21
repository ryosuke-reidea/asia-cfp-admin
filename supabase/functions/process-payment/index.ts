const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProcessPaymentRequest {
  reservationId: string;
  amount?: number; // オプション：指定されない場合は予約の金額を使用
}

interface ProcessPaymentResponse {
  success: boolean;
  paymentIntentId?: string;
  status?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const { reservationId, amount }: ProcessPaymentRequest = await req.json();

    if (!reservationId) {
      throw new Error('Reservation ID is required');
    }

    // Supabaseクライアントの初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // 予約情報を取得
    const reservationResponse = await fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${reservationId}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!reservationResponse.ok) {
      throw new Error('Failed to fetch reservation');
    }

    const reservations = await reservationResponse.json();
    if (!reservations || reservations.length === 0) {
      throw new Error('Reservation not found');
    }

    const reservation = reservations[0];
    
    // 決済金額を決定（指定されていない場合は予約の金額を使用）
    const paymentAmount = amount || reservation.amount;
    
    // Stripe PaymentIntentを作成
    const paymentIntentData = {
    amount: Math.round(paymentAmount * 100),
    currency: reservation.currency.toLowerCase(),
    customer: reservation.stripe_customer_id,
    payment_method: reservation.stripe_payment_method_id,
    off_session: true, // 復活させる
    confirm: true,
    payment_method_options: {
      card: {
        moto: true // Mail Order/Telephone Order - 管理者による手動決済
      }
    },
    metadata: {
      reservation_id: reservationId,
      project_id: reservation.project_id,
      reward_id: reservation.reward_id || 'none',
    },
  };

    console.log('Creating PaymentIntent with data:', {
      ...paymentIntentData,
      amount: paymentIntentData.amount / 100, // ログ用に元の金額で表示
    });

    // Stripe API用のフォームデータを手動で構築
    const formData = new URLSearchParams();
    formData.append('amount', paymentIntentData.amount.toString());
    formData.append('currency', paymentIntentData.currency);
    formData.append('customer', paymentIntentData.customer);
    formData.append('payment_method', paymentIntentData.payment_method);
    formData.append('off_session', 'true');
    formData.append('confirm', 'true');
    
    // メタデータを個別に追加
    formData.append('metadata[reservation_id]', reservationId);
    formData.append('metadata[project_id]', reservation.project_id);
    formData.append('metadata[reward_id]', reservation.reward_id || 'none');

    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const paymentIntent = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('Stripe error:', paymentIntent);
      throw new Error(paymentIntent.error?.message || 'Payment processing failed');
    }

    console.log('PaymentIntent created:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
    });

    // 決済が成功した場合、予約のステータスを更新
    if (paymentIntent.status === 'succeeded') {
      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${reservationId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'charged',
          updated_at: new Date().toISOString(),
        }),
      });

      if (!updateResponse.ok) {
        console.error('Failed to update reservation status');
      } else {
        console.log('Reservation status updated to charged');
      }
    }

    const response: ProcessPaymentResponse = {
      success: paymentIntent.status === 'succeeded',
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    
    const errorResponse: ProcessPaymentResponse = {
      success: false,
      error: error.message,
    };

    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
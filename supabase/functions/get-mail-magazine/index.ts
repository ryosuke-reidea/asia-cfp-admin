// Define CORS headers directly in the file instead of importing
const corsHeaders = {
  'Access-Control-Allow-Origin': "*",
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const apiKey = Deno.env.get('REIDEA_MAILER_API_KEY');
    if (!apiKey) {
      throw new Error('Missing API key');
    }
    // リクエストボディからIDを取得
    const body = await req.json();
    const ids = body?.ids;
    const limit = body?.limit;
    const offset = body?.offset;
    // TODO: メルマガ登録用のAPIを変更する
    const queryParams = new URLSearchParams();
    if (ids) queryParams.append('mail_ids', ids);
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    const res = await fetch(`https://mailer.kaigai-kurafan.com/mails?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
    });
    if (!res.ok) {
      throw new Error('Failed to fetch mail magazines');
    }
    const data = await res.json();
    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});

// Define CORS headers directly in the file instead of importing
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS',
  };
  
  Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
  
    try {
      const apiKey = Deno.env.get('REIDEA_MAILER_API_KEY');
      if (!apiKey) {
        throw new Error('Missing API key');
      }
  
      const body = await req.json();
  
      const res = await fetch('https://mailer.kaigai-kurafan.com/mails/recreate-multiple', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });
  
      if (!res.ok) {
        throw new Error(`Failed to send mail: ${res.statusText}`);
      }
  
      const data = await res.json();
  
      return new Response(
        JSON.stringify({ success: true, data }), 
        {
          headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
  
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }), 
        {
          headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
  });
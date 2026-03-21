const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, PUT, GET, DELETE, OPTIONS"
};

Deno.serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow DELETE
  if (req.method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 405
    });
  }

  try {
    const apiKey = Deno.env.get("REIDEA_MAILER_API_KEY");
    if (!apiKey) throw new Error("Missing API key");

    const url = new URL(req.url);
    const mailMagazineId = url.searchParams.get("mailMagazineId");
    if (!mailMagazineId) throw new Error("mailMagazineId is required");

    console.log("Deleting mail magazine:", mailMagazineId);

    const res = await fetch(`https://mailer.kaigai-kurafan.com/mails/${mailMagazineId}/cancel`, {
      method: "GET", // ← API が GET なのは少し特殊。必要なら DELETE に直す
      headers: { "x-api-key": apiKey }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to delete mail magazine: ${res.status} ${errorText}`);
    }

    return new Response(JSON.stringify({
      success: true,
      data: { message: "Mail magazine deleted successfully" }
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });

  } catch (error) {
    console.error("Error in delete-mail-magazine:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS',
};

interface KickstarterData {
  title: string;
  subtitle: string;
  imageUrl: string;
  targetAmount: number;
  currentAmount: number;
  backersCount: number;
  category: string;
  description: string;
  creatorDescription: string;
  videoUrl?: string;
  rewards?: KickstarterReward[];
}

interface KickstarterReward {
  title: string;
  description: string;
  price: number;
  estimatedDelivery: string;
  imageUrl?: string;
  quantityAvailable?: number;
  backersCount: number;
}

Deno.serve(async (req) => {
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
    const { url } = await req.json();

    if (!url || !url.includes('kickstarter.com')) {
      throw new Error('Valid Kickstarter URL is required');
    }

    console.log('Scraping Kickstarter URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Kickstarter page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const data = extractData(html);

    console.log('Successfully scraped data:', {
      title: data.title,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount,
      backersCount: data.backersCount,
      category: data.category,
    });

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to scrape Kickstarter data. Please check the URL and try again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function extractData(html: string): KickstarterData {
  // Strategy 1: Extract from embedded JSON data (most reliable)
  const jsonData = extractEmbeddedJson(html);
  if (jsonData) {
    console.log('Extracted data from embedded JSON');
    return jsonData;
  }

  // Strategy 2: Extract from meta tags + data attributes
  console.log('Falling back to meta tags + HTML extraction');
  return extractFromHtml(html);
}

/**
 * KickstarterはページにプロジェクトデータをJSON形式で埋め込んでいる。
 * window.current_project, data-initial, __NEXT_DATA__ などから取得。
 */
function extractEmbeddedJson(html: string): KickstarterData | null {
  // Pattern 1: window.current_project = {...}
  const currentProjectMatch = html.match(/window\.current_project\s*=\s*"([^"]+)"/);
  if (currentProjectMatch) {
    try {
      const decoded = currentProjectMatch[1]
        .replace(/\\&quot;/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const project = JSON.parse(decoded);
      return mapProjectJson(project);
    } catch (e) {
      console.log('Failed to parse window.current_project:', e);
    }
  }

  // Pattern 2: data-initial attribute containing project JSON
  const dataInitialMatch = html.match(/data-initial="([^"]+)"/);
  if (dataInitialMatch) {
    try {
      const decoded = dataInitialMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const data = JSON.parse(decoded);
      const project = data.project || data;
      if (project.goal || project.pledged) {
        return mapProjectJson(project);
      }
    } catch (e) {
      console.log('Failed to parse data-initial:', e);
    }
  }

  // Pattern 3: React/Next.js style embedded JSON
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    const content = match[1];

    // Look for project data object with goal/pledged/backers_count
    if (content.includes('pledged') && content.includes('goal') && content.includes('backers_count')) {
      // Try to find a JSON object containing project data
      const jsonPatterns = [
        /\{[^{}]*"goal"\s*:\s*\d[\s\S]*?"pledged"\s*:\s*\d[\s\S]*?"backers_count"\s*:\s*\d[^{}]*\}/,
        /\{[\s\S]*?"project"\s*:\s*\{[\s\S]*?"goal"\s*:[\s\S]*?\}\}/,
      ];

      for (const pattern of jsonPatterns) {
        const jsonMatch = content.match(pattern);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            const project = parsed.project || parsed;
            if (project.goal && project.pledged !== undefined) {
              return mapProjectJson(project);
            }
          } catch {
            // Continue to next pattern
          }
        }
      }
    }
  }

  // Pattern 4: Look for JSON-LD with funding data
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const ld = JSON.parse(match[1]);
      if (ld['@type'] === 'CreativeWork' || ld['@type'] === 'Product' || ld.name) {
        // JSON-LD doesn't usually have funding data, but might have basic info
        // We'll use it as supplementary data later if needed
      }
    } catch {
      // Skip invalid JSON-LD
    }
  }

  return null;
}

/**
 * KickstarterのプロジェクトJSONをKickstarterDataにマッピング
 */
function mapProjectJson(project: any): KickstarterData {
  const goal = typeof project.goal === 'object' ? project.goal.amount : project.goal;
  const pledged = typeof project.pledged === 'object' ? project.pledged.amount : project.pledged;

  return {
    title: project.name || project.title || '',
    subtitle: project.blurb || project.subtitle || '',
    imageUrl: project.photo?.full || project.photo?.med || project.image_url || '',
    targetAmount: parseFloat(goal) || 0,
    currentAmount: parseFloat(pledged) || 0,
    backersCount: parseInt(project.backers_count) || 0,
    category: project.category?.name || project.category?.slug || '',
    description: project.description || '',
    creatorDescription: project.creator?.blurb || project.creator?.biography || '',
    videoUrl: project.video?.high || project.video?.base || undefined,
    rewards: mapRewards(project.rewards),
  };
}

function mapRewards(rewards: any[] | undefined): KickstarterReward[] | undefined {
  if (!rewards || !Array.isArray(rewards) || rewards.length === 0) return undefined;

  return rewards
    .filter((r: any) => r.minimum || r.pledge_amount)
    .map((r: any) => ({
      title: r.title || r.reward || '',
      description: r.description || '',
      price: parseFloat(r.minimum || r.pledge_amount) || 0,
      estimatedDelivery: r.estimated_delivery || '',
      backersCount: parseInt(r.backers_count) || 0,
      quantityAvailable: r.limit ? parseInt(r.limit) - (parseInt(r.backers_count) || 0) : undefined,
    }));
}

/**
 * HTMLメタタグ・data属性からの抽出（フォールバック）
 */
function extractFromHtml(html: string): KickstarterData {
  const cleanText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  const parseCurrency = (text: string): number => {
    if (!text) return 0;
    const match = text.replace(/,/g, '').match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  };

  // Title
  let title = '';
  const titlePatterns = [
    /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ];
  for (const p of titlePatterns) {
    const m = html.match(p);
    if (m) {
      title = cleanText(m[1]).replace(/\s*[—–-]\s*Kickstarter$/, '');
      break;
    }
  }

  // Subtitle
  let subtitle = '';
  const subtitlePatterns = [
    /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i,
    /<meta[^>]*name="description"[^>]*content="([^"]+)"/i,
  ];
  for (const p of subtitlePatterns) {
    const m = html.match(p);
    if (m) { subtitle = cleanText(m[1]); break; }
  }

  // Image
  let imageUrl = '';
  const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (imgMatch) imageUrl = imgMatch[1];

  // Funding data from data attributes
  let targetAmount = 0;
  let currentAmount = 0;
  let backersCount = 0;

  const goalMatch = html.match(/data-goal="([^"]+)"/i);
  if (goalMatch) targetAmount = parseCurrency(goalMatch[1]);

  const pledgedMatch = html.match(/data-pledged="([^"]+)"/i);
  if (pledgedMatch) currentAmount = parseCurrency(pledgedMatch[1]);

  const backersMatch = html.match(/data-backers-count="([^"]+)"/i);
  if (backersMatch) backersCount = parseInt(backersMatch[1]) || 0;

  // Funding data from specific HTML structure (more targeted than before)
  if (targetAmount === 0) {
    // Look for goal in specific context: "pledged of $X goal"
    const goalCtxMatch = html.match(/pledged\s+of\s+[\$¥€£]?([\d,]+(?:\.\d+)?)\s*(?:goal|目標)/i);
    if (goalCtxMatch) targetAmount = parseCurrency(goalCtxMatch[1]);
  }

  if (currentAmount === 0) {
    // Look for pledged amount: "$X pledged"
    const pledgedCtxMatch = html.match(/[\$¥€£]([\d,]+(?:\.\d+)?)\s*(?:pledged|調達済)/i);
    if (pledgedCtxMatch) currentAmount = parseCurrency(pledgedCtxMatch[1]);
  }

  if (backersCount === 0) {
    // Look for backers count: "X backers" in specific context
    const backersCtxMatch = html.match(/([\d,]+)\s*(?:backers|supporters|バッカー)/i);
    if (backersCtxMatch) backersCount = parseInt(backersCtxMatch[1].replace(/,/g, '')) || 0;
  }

  // Video
  let videoUrl = '';
  const videoMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i);
  if (videoMatch) videoUrl = videoMatch[1];

  // Category
  let category = '';
  const catMatch = html.match(/<a[^>]*href="\/discover\/categories\/([^"/?]+)/i);
  if (catMatch) category = catMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return {
    title: title || 'Untitled Project',
    subtitle,
    imageUrl,
    targetAmount,
    currentAmount,
    backersCount,
    category: category || '',
    description: '',
    creatorDescription: '',
    videoUrl: videoUrl || undefined,
  };
}

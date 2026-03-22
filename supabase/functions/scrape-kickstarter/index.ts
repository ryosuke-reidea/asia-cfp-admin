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

interface StatsData {
  project: {
    id: number;
    state: string;
    backers_count: number;
    pledged: string;
    comments_count: number;
  };
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
    const { url, mode } = await req.json();

    if (!url || !url.includes('kickstarter.com')) {
      throw new Error('Valid Kickstarter URL is required');
    }

    console.log('Fetching Kickstarter data:', url, 'mode:', mode || 'auto');

    // Strategy 1: stats.json（Cloudflare回避可能、stats更新に最適）
    const statsData = await fetchStats(url);
    if (statsData) {
      console.log('Successfully fetched stats.json:', statsData);

      // stats-onlyモード or フルスクレイプ不要の場合はここで返す
      const data: KickstarterData = {
        title: '',
        subtitle: '',
        imageUrl: '',
        targetAmount: 0,
        currentAmount: parseFloat(statsData.project.pledged) || 0,
        backersCount: statsData.project.backers_count || 0,
        category: '',
        description: '',
        creatorDescription: '',
      };

      // mode=stats の場合、またはフルスクレイプが不要な場合
      if (mode === 'stats') {
        return new Response(
          JSON.stringify({ success: true, data, source: 'stats.json' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // フルスクレイプも試みる（初回登録時など）
      try {
        const fullData = await fetchFullPage(url);
        if (fullData) {
          // stats.jsonの最新データで上書き
          fullData.currentAmount = data.currentAmount;
          fullData.backersCount = data.backersCount;
          return new Response(
            JSON.stringify({ success: true, data: fullData, source: 'full+stats' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      } catch (e) {
        console.log('Full page scrape failed, returning stats only:', e);
      }

      // フルスクレイプ失敗でもstatsデータは返す
      return new Response(
        JSON.stringify({ success: true, data, source: 'stats.json' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Strategy 2: HTMLページからの抽出（stats.jsonが使えない場合）
    const fullData = await fetchFullPage(url);
    if (fullData) {
      return new Response(
        JSON.stringify({ success: true, data: fullData, source: 'html' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    throw new Error('All scraping strategies failed');
  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to scrape Kickstarter data. Please check the URL and try again.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * stats.json エンドポイントからデータを取得（Cloudflare回避可能）
 * URLから /projects/creator/project-name を抽出し、stats.json を付加
 */
async function fetchStats(url: string): Promise<StatsData | null> {
  try {
    // URLからプロジェクトパスを抽出
    const match = url.match(/kickstarter\.com\/(projects\/[^/?#]+\/[^/?#]+)/);
    if (!match) return null;

    const statsUrl = `https://www.kickstarter.com/${match[1]}/stats.json`;
    console.log('Fetching stats.json:', statsUrl);

    const response = await fetch(statsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('stats.json returned:', response.status);
      return null;
    }

    return await response.json();
  } catch (e) {
    console.log('stats.json fetch failed:', e);
    return null;
  }
}

/**
 * HTMLページ全体をフェッチしてデータを抽出（Cloudflareにブロックされる可能性あり）
 */
async function fetchFullPage(url: string): Promise<KickstarterData | null> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) return null;

  const html = await response.text();

  // Cloudflareチャレンジページの場合はnull
  if (html.includes('Just a moment') || html.includes('Enable JavaScript and cookies')) {
    console.log('Cloudflare challenge detected, skipping HTML extraction');
    return null;
  }

  return extractData(html);
}

function extractData(html: string): KickstarterData {
  const jsonData = extractEmbeddedJson(html);
  if (jsonData) return jsonData;
  return extractFromHtml(html);
}

function extractEmbeddedJson(html: string): KickstarterData | null {
  const currentProjectMatch = html.match(/window\.current_project\s*=\s*"([^"]+)"/);
  if (currentProjectMatch) {
    try {
      const decoded = currentProjectMatch[1]
        .replace(/\\&quot;/g, '"').replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return mapProjectJson(JSON.parse(decoded));
    } catch (e) { console.log('Failed to parse window.current_project:', e); }
  }

  const dataInitialMatch = html.match(/data-initial="([^"]+)"/);
  if (dataInitialMatch) {
    try {
      const decoded = dataInitialMatch[1]
        .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const data = JSON.parse(decoded);
      const project = data.project || data;
      if (project.goal || project.pledged) return mapProjectJson(project);
    } catch (e) { console.log('Failed to parse data-initial:', e); }
  }

  return null;
}

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

function extractFromHtml(html: string): KickstarterData {
  const cleanText = (text: string): string =>
    text ? text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim() : '';
  const parseCurrency = (text: string): number => {
    if (!text) return 0;
    const match = text.replace(/,/g, '').match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  };

  let title = '';
  for (const p of [/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i, /<title[^>]*>([^<]+)<\/title>/i]) {
    const m = html.match(p);
    if (m) { title = cleanText(m[1]).replace(/\s*[—–-]\s*Kickstarter$/, ''); break; }
  }

  let subtitle = '';
  for (const p of [/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i, /<meta[^>]*name="description"[^>]*content="([^"]+)"/i]) {
    const m = html.match(p);
    if (m) { subtitle = cleanText(m[1]); break; }
  }

  const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  const imageUrl = imgMatch ? imgMatch[1] : '';

  let targetAmount = 0, currentAmount = 0, backersCount = 0;
  const goalMatch = html.match(/data-goal="([^"]+)"/i);
  if (goalMatch) targetAmount = parseCurrency(goalMatch[1]);
  const pledgedMatch = html.match(/data-pledged="([^"]+)"/i);
  if (pledgedMatch) currentAmount = parseCurrency(pledgedMatch[1]);
  const backersMatch = html.match(/data-backers-count="([^"]+)"/i);
  if (backersMatch) backersCount = parseInt(backersMatch[1]) || 0;

  return {
    title: title || 'Untitled Project', subtitle, imageUrl,
    targetAmount, currentAmount, backersCount,
    category: '', description: '', creatorDescription: '',
  };
}

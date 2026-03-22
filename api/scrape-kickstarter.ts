import type { VercelRequest, VercelResponse } from '@vercel/node';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url || !url.includes('kickstarter.com/projects/')) {
    return res.status(400).json({ error: 'Valid Kickstarter project URL is required' });
  }

  let browser = null;

  try {
    // Cloudflare Bot検出を回避するための設定
    chromium.setGraphicsMode = false;

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Bot検出回避: webdriver プロパティを隠す
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Chrome runtimeを偽装
      (window as any).chrome = { runtime: {} };
      // permissionsを偽装
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
      // pluginsを偽装
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      // languagesを偽装
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Cloudflareチャレンジを突破するため長めに待つ
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });

    // Cloudflareチャレンジページが表示されている場合、追加で待機
    const pageTitle = await page.title();
    if (pageTitle.includes('Just a moment') || pageTitle.includes('Checking')) {
      console.log('Cloudflare challenge detected, waiting...');
      await page.waitForFunction(
        () => !document.title.includes('Just a moment') && !document.title.includes('Checking'),
        { timeout: 20000 }
      );
      // チャレンジ通過後、ページが完全に読み込まれるのを待つ
      await page.waitForNetworkIdle({ timeout: 10000 });
    }

    // ページからプロジェクトデータを抽出
    const data = await page.evaluate(() => {
      const parseNum = (text: string | null | undefined): number => {
        if (!text) return 0;
        return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
      };

      // Strategy 1: window.current_project
      const cp = (window as any).current_project;
      if (cp) {
        const goal = typeof cp.goal === 'object' ? cp.goal.amount : cp.goal;
        const pledged = typeof cp.pledged === 'object' ? cp.pledged.amount : cp.pledged;
        return {
          title: cp.name || '',
          subtitle: cp.blurb || '',
          imageUrl: cp.photo?.full || cp.photo?.med || '',
          targetAmount: parseFloat(goal) || 0,
          currentAmount: parseFloat(pledged) || 0,
          backersCount: parseInt(cp.backers_count) || 0,
          category: cp.category?.name || '',
          source: 'window.current_project',
        };
      }

      // Strategy 2: data-initial属性
      const dataInitialEl = document.querySelector('[data-initial]');
      if (dataInitialEl) {
        try {
          const d = JSON.parse(dataInitialEl.getAttribute('data-initial') || '{}');
          const p = d.project;
          if (p && (p.goal || p.pledged)) {
            const goal = typeof p.goal === 'object' ? p.goal.amount : p.goal;
            const pledged = typeof p.pledged === 'object' ? p.pledged.amount : p.pledged;
            return {
              title: p.name || '',
              subtitle: p.blurb || '',
              imageUrl: p.photo?.full || p.photo?.med || '',
              targetAmount: parseFloat(goal) || 0,
              currentAmount: parseFloat(pledged) || 0,
              backersCount: parseInt(p.backers_count) || 0,
              category: p.category?.name || '',
              source: 'data-initial',
            };
          }
        } catch {}
      }

      // Strategy 3: ページ上のReactコンポーネントのpropsからデータを取得
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.includes('"pledged"') && text.includes('"goal"') && text.includes('"backers_count"')) {
          try {
            // pledged/goal/backers_countを含むJSONオブジェクトを抽出
            const match = text.match(/"goal"\s*:\s*([\d.]+).*?"pledged"\s*:\s*([\d.]+).*?"backers_count"\s*:\s*(\d+)/s);
            if (match) {
              return {
                title: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(/\s*[—–-]\s*Kickstarter$/, '') || '',
                subtitle: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
                imageUrl: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
                targetAmount: parseFloat(match[1]) || 0,
                currentAmount: parseFloat(match[2]) || 0,
                backersCount: parseInt(match[3]) || 0,
                category: '',
                source: 'script-regex',
              };
            }
          } catch {}
        }
      }

      // Strategy 4: DOM要素から直接取得
      let targetAmount = 0;
      let currentAmount = 0;
      let backersCount = 0;

      // data属性
      const goalEl = document.querySelector('[data-goal]');
      if (goalEl) targetAmount = parseNum(goalEl.getAttribute('data-goal'));
      const pledgedEl = document.querySelector('[data-pledged]');
      if (pledgedEl) currentAmount = parseNum(pledgedEl.getAttribute('data-pledged'));
      const backersEl = document.querySelector('[data-backers-count]');
      if (backersEl) backersCount = parseInt(backersEl.getAttribute('data-backers-count') || '0');

      // テキストからの抽出
      if (currentAmount === 0 || targetAmount === 0 || backersCount === 0) {
        const bodyText = document.body.innerText;

        if (currentAmount === 0) {
          const m = bodyText.match(/[\$€£¥]\s*([\d,]+(?:\.\d+)?)\s*\n?\s*pledged/i);
          if (m) currentAmount = parseNum(m[1]);
        }
        if (targetAmount === 0) {
          const m = bodyText.match(/pledged of\s*[\$€£¥]\s*([\d,]+(?:\.\d+)?)\s*goal/i);
          if (m) targetAmount = parseNum(m[1]);
        }
        if (backersCount === 0) {
          const m = bodyText.match(/([\d,]+)\s*\n?\s*backers?/i);
          if (m) backersCount = parseInt(m[1].replace(/,/g, ''));
        }
      }

      return {
        title: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(/\s*[—–-]\s*Kickstarter$/, '') || '',
        subtitle: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        imageUrl: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        targetAmount,
        currentAmount,
        backersCount,
        category: '',
        source: 'dom-fallback',
      };
    });

    // デバッグ情報
    console.log('Scraped data:', JSON.stringify(data));

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Scraping error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape Kickstarter data',
    });
  } finally {
    if (browser) await browser.close();
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import chromium from '@sparticuz/chromium';
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

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
    browser = await puppeteerExtra.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // ナビゲーション
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Cloudflareチャレンジ検出 & 待機
    const isChallenge = await page.evaluate(() =>
      document.title.includes('Just a moment') || document.title.includes('Checking')
    );

    if (isChallenge) {
      console.log('Cloudflare challenge detected, waiting for resolution...');
      try {
        await page.waitForFunction(
          () => !document.title.includes('Just a moment') && !document.title.includes('Checking'),
          { timeout: 25000 }
        );
        // チャレンジ通過後、コンテンツ読み込み待ち
        await new Promise(r => setTimeout(r, 3000));
      } catch {
        console.log('Cloudflare challenge timeout - proceeding with current page');
      }
    }

    // networkIdleを待つ
    try {
      await page.waitForNetworkIdle({ timeout: 10000 });
    } catch {
      // タイムアウトしても続行
    }

    // デバッグ: ページタイトルとURLを記録
    const finalTitle = await page.title();
    const finalUrl = page.url();
    console.log('Final page:', { title: finalTitle, url: finalUrl });

    // データ抽出
    const data = await page.evaluate(() => {
      const parseNum = (text: string | null | undefined): number => {
        if (!text) return 0;
        return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
      };

      // ページがまだCloudflareチャレンジの場合
      if (document.title.includes('Just a moment') || document.title.includes('Checking')) {
        return {
          title: '', subtitle: '', imageUrl: '',
          targetAmount: 0, currentAmount: 0, backersCount: 0,
          category: '', source: 'cloudflare-blocked',
          debug: 'Cloudflare challenge was not resolved',
        };
      }

      // Strategy 1: window.current_project
      const cp = (window as any).current_project;
      if (cp) {
        const goal = typeof cp.goal === 'object' ? cp.goal.amount : cp.goal;
        const pledged = typeof cp.pledged === 'object' ? cp.pledged.amount : cp.pledged;
        return {
          title: cp.name || '', subtitle: cp.blurb || '',
          imageUrl: cp.photo?.full || cp.photo?.med || '',
          targetAmount: parseFloat(goal) || 0,
          currentAmount: parseFloat(pledged) || 0,
          backersCount: parseInt(cp.backers_count) || 0,
          category: cp.category?.name || '',
          source: 'window.current_project',
        };
      }

      // Strategy 2: data-initial
      const diEl = document.querySelector('[data-initial]');
      if (diEl) {
        try {
          const d = JSON.parse(diEl.getAttribute('data-initial') || '{}');
          const p = d.project;
          if (p && (p.goal || p.pledged)) {
            const goal = typeof p.goal === 'object' ? p.goal.amount : p.goal;
            const pledged = typeof p.pledged === 'object' ? p.pledged.amount : p.pledged;
            return {
              title: p.name || '', subtitle: p.blurb || '',
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

      // Strategy 3: scriptタグからJSON抽出
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.includes('"pledged"') && text.includes('"goal"')) {
          const goalMatch = text.match(/"goal"\s*:\s*([\d.]+)/);
          const pledgedMatch = text.match(/"pledged"\s*:\s*([\d.]+)/);
          const backersMatch = text.match(/"backers_count"\s*:\s*(\d+)/);
          if (goalMatch && pledgedMatch) {
            return {
              title: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(/\s*[—–-]\s*Kickstarter$/, '') || '',
              subtitle: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
              imageUrl: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
              targetAmount: parseFloat(goalMatch[1]) || 0,
              currentAmount: parseFloat(pledgedMatch[1]) || 0,
              backersCount: backersMatch ? parseInt(backersMatch[1]) : 0,
              category: '', source: 'script-regex',
            };
          }
        }
      }

      // Strategy 4: DOM テキスト抽出
      let targetAmount = 0, currentAmount = 0, backersCount = 0;

      const goalEl = document.querySelector('[data-goal]');
      if (goalEl) targetAmount = parseNum(goalEl.getAttribute('data-goal'));
      const pledgedEl = document.querySelector('[data-pledged]');
      if (pledgedEl) currentAmount = parseNum(pledgedEl.getAttribute('data-pledged'));
      const backersEl = document.querySelector('[data-backers-count]');
      if (backersEl) backersCount = parseInt(backersEl.getAttribute('data-backers-count') || '0');

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

      // デバッグ: bodyの最初の500文字を返す
      const bodyPreview = document.body.innerText.substring(0, 500);

      return {
        title: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(/\s*[—–-]\s*Kickstarter$/, '') || '',
        subtitle: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        imageUrl: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        targetAmount, currentAmount, backersCount,
        category: '', source: 'dom-fallback',
        debug: bodyPreview,
      };
    });

    console.log('Scraped result:', JSON.stringify(data));

    // Cloudflareにブロックされた場合はエラーとして返す
    if (data.source === 'cloudflare-blocked') {
      return res.status(503).json({
        success: false,
        error: 'Cloudflare protection could not be bypassed',
        data,
      });
    }

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

import type { VercelRequest, VercelResponse } from '@vercel/node';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || !url.includes('kickstarter.com/projects/')) {
    return res.status(400).json({ error: 'Valid Kickstarter project URL is required' });
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // ページからプロジェクトデータを抽出
    const data = await page.evaluate(() => {
      // Helper: テキストからクリーンな数値を抽出
      const parseNumber = (text: string | null | undefined): number => {
        if (!text) return 0;
        const cleaned = text.replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
      };

      // Strategy 1: window.current_project（KSが埋め込むJSON）
      const currentProject = (window as any).current_project;
      if (currentProject) {
        const goal = typeof currentProject.goal === 'object'
          ? currentProject.goal.amount
          : currentProject.goal;
        const pledged = typeof currentProject.pledged === 'object'
          ? currentProject.pledged.amount
          : currentProject.pledged;

        return {
          title: currentProject.name || '',
          subtitle: currentProject.blurb || '',
          imageUrl: currentProject.photo?.full || currentProject.photo?.med || '',
          targetAmount: parseFloat(goal) || 0,
          currentAmount: parseFloat(pledged) || 0,
          backersCount: parseInt(currentProject.backers_count) || 0,
          category: currentProject.category?.name || '',
          description: currentProject.description || '',
          creatorDescription: currentProject.creator?.blurb || '',
          source: 'window.current_project',
        };
      }

      // Strategy 2: data-initial属性
      const dataInitialEl = document.querySelector('[data-initial]');
      if (dataInitialEl) {
        try {
          const initialData = JSON.parse(dataInitialEl.getAttribute('data-initial') || '{}');
          const project = initialData.project;
          if (project && (project.goal || project.pledged)) {
            const goal = typeof project.goal === 'object' ? project.goal.amount : project.goal;
            const pledged = typeof project.pledged === 'object' ? project.pledged.amount : project.pledged;

            return {
              title: project.name || '',
              subtitle: project.blurb || '',
              imageUrl: project.photo?.full || project.photo?.med || '',
              targetAmount: parseFloat(goal) || 0,
              currentAmount: parseFloat(pledged) || 0,
              backersCount: parseInt(project.backers_count) || 0,
              category: project.category?.name || '',
              description: project.description || '',
              creatorDescription: project.creator?.blurb || '',
              source: 'data-initial',
            };
          }
        } catch {}
      }

      // Strategy 3: DOM要素から直接取得
      const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(/\s*[—–-]\s*Kickstarter$/, '') || '';
      const subtitle = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const imageUrl = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      // data属性から取得
      let targetAmount = 0;
      let currentAmount = 0;
      let backersCount = 0;

      const goalEl = document.querySelector('[data-goal]');
      if (goalEl) targetAmount = parseNumber(goalEl.getAttribute('data-goal'));

      const pledgedEl = document.querySelector('[data-pledged]');
      if (pledgedEl) currentAmount = parseNumber(pledgedEl.getAttribute('data-pledged'));

      const backersEl = document.querySelector('[data-backers-count]');
      if (backersEl) backersCount = parseInt(backersEl.getAttribute('data-backers-count') || '0');

      // DOM内のテキストからフォールバック取得
      if (currentAmount === 0) {
        // "pledged of" の前にある金額を探す
        const allText = document.body.innerText;
        const pledgedMatch = allText.match(/[\$€£¥][\s]*([\d,]+(?:\.\d+)?)\s*(?:\n|\r|\s)*pledged/i);
        if (pledgedMatch) currentAmount = parseNumber(pledgedMatch[1]);
      }

      if (targetAmount === 0) {
        const allText = document.body.innerText;
        const goalMatch = allText.match(/pledged of\s*[\$€£¥][\s]*([\d,]+(?:\.\d+)?)\s*goal/i);
        if (goalMatch) targetAmount = parseNumber(goalMatch[1]);
      }

      if (backersCount === 0) {
        const allText = document.body.innerText;
        const backersMatch = allText.match(/([\d,]+)\s*backers?/i);
        if (backersMatch) backersCount = parseInt(backersMatch[1].replace(/,/g, ''));
      }

      return {
        title,
        subtitle,
        imageUrl,
        targetAmount,
        currentAmount,
        backersCount,
        category: '',
        description: '',
        creatorDescription: '',
        source: 'dom-fallback',
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Scraping error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape Kickstarter data',
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

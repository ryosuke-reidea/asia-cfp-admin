// Define CORS headers directly in the file instead of importing
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
    const { url } = await req.json();

    if (!url || !url.includes('kickstarter.com')) {
      throw new Error('Valid Kickstarter URL is required');
    }

    console.log('Scraping Kickstarter URL:', url);

    // Fetch the Kickstarter page with better headers and error handling
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Kickstarter page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extract data using improved regex patterns and JSON-LD structured data
    const extractData = (html: string): KickstarterData => {
      // Helper functions
      const extractBetween = (text: string, start: string, end: string): string => {
        const startIndex = text.indexOf(start);
        if (startIndex === -1) return '';
        const endIndex = text.indexOf(end, startIndex + start.length);
        if (endIndex === -1) return '';
        return text.substring(startIndex + start.length, endIndex).trim();
      };

      const cleanHtml = (text: string): string => {
        if (!text) return '';
        return text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
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

      const extractNumber = (text: string): number => {
        if (!text) return 0;
        const cleanText = text.replace(/[,$\s]/g, '');
        const match = cleanText.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const extractCurrency = (text: string): number => {
        if (!text) return 0;
        // Handle different currency formats
        const match = text.match(/[\$¥€£]?([\d,]+(?:\.\d{2})?)/);
        if (match) {
          return parseFloat(match[1].replace(/,/g, ''));
        }
        return 0;
      };

      // Try to extract JSON-LD structured data first
      let structuredData: any = null;
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          structuredData = JSON.parse(jsonLdMatch[1]);
        } catch (e) {
          console.log('Failed to parse JSON-LD:', e);
        }
      }

      // Extract title with multiple fallbacks
      let title = '';
      if (structuredData?.name) {
        title = structuredData.name;
      } else {
        const titlePatterns = [
          /<h1[^>]*class="[^"]*type-24[^"]*"[^>]*>([^<]+)</i,
          /<h1[^>]*data-test-id="project-name"[^>]*>([^<]+)</i,
          /<title[^>]*>([^<]+)</i,
          /<h1[^>]*>([^<]+)</i,
        ];
        
        for (const pattern of titlePatterns) {
          const match = html.match(pattern);
          if (match) {
            title = cleanHtml(match[1]).replace(' — Kickstarter', '').replace(' by ', ' by ');
            break;
          }
        }
      }

      // Extract subtitle/description
      let subtitle = '';
      if (structuredData?.description) {
        subtitle = structuredData.description;
      } else {
        const subtitlePatterns = [
          /<meta[^>]*name="description"[^>]*content="([^"]+)"/i,
          /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i,
          /<p[^>]*class="[^"]*type-16[^"]*"[^>]*>([^<]+)</i,
        ];
        
        for (const pattern of subtitlePatterns) {
          const match = html.match(pattern);
          if (match) {
            subtitle = cleanHtml(match[1]);
            break;
          }
        }
      }

      // Extract image URL
      let imageUrl = '';
      if (structuredData?.image) {
        imageUrl = Array.isArray(structuredData.image) ? structuredData.image[0] : structuredData.image;
      } else {
        const imagePatterns = [
          /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
          /<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i,
          /<img[^>]*class="[^"]*project-image[^"]*"[^>]*src="([^"]+)"/i,
        ];
        
        for (const pattern of imagePatterns) {
          const match = html.match(pattern);
          if (match) {
            imageUrl = match[1];
            break;
          }
        }
      }

      // Extract funding data with improved patterns
      let targetAmount = 0;
      let currentAmount = 0;
      let backersCount = 0;

      // Look for data attributes first (most reliable)
      const goalMatch = html.match(/data-goal="([^"]+)"/i);
      if (goalMatch) {
        targetAmount = extractCurrency(goalMatch[1]);
      }

      const pledgedMatch = html.match(/data-pledged="([^"]+)"/i);
      if (pledgedMatch) {
        currentAmount = extractCurrency(pledgedMatch[1]);
      }

      const backersMatch = html.match(/data-backers-count="([^"]+)"/i);
      if (backersMatch) {
        backersCount = extractNumber(backersMatch[1]);
      }

      // Fallback to text-based extraction
      if (targetAmount === 0) {
        const goalPatterns = [
          /goal[^>]*>[\s\S]*?[\$¥€£]([\d,]+)/i,
          /target[^>]*>[\s\S]*?[\$¥€£]([\d,]+)/i,
          /[\$¥€£]([\d,]+)[^>]*goal/i,
        ];
        
        for (const pattern of goalPatterns) {
          const match = html.match(pattern);
          if (match) {
            targetAmount = extractCurrency(match[1]);
            break;
          }
        }
      }

      if (currentAmount === 0) {
        const pledgedPatterns = [
          /pledged[^>]*>[\s\S]*?[\$¥€£]([\d,]+)/i,
          /raised[^>]*>[\s\S]*?[\$¥€£]([\d,]+)/i,
          /[\$¥€£]([\d,]+)[^>]*pledged/i,
        ];
        
        for (const pattern of pledgedPatterns) {
          const match = html.match(pattern);
          if (match) {
            currentAmount = extractCurrency(match[1]);
            break;
          }
        }
      }

      if (backersCount === 0) {
        const backersPatterns = [
          /(\d+)[^>]*backers?/i,
          /backers?[^>]*>[\s\S]*?(\d+)/i,
          /(\d+)[^>]*supporters?/i,
        ];
        
        for (const pattern of backersPatterns) {
          const match = html.match(pattern);
          if (match) {
            backersCount = extractNumber(match[1]);
            break;
          }
        }
      }

      // Extract category
      let category = '';
      const categoryPatterns = [
        /<a[^>]*href="[^"]*\/discover\/categories\/([^"\/\?]+)/i,
        /<span[^>]*class="[^"]*category[^"]*"[^>]*>([^<]+)</i,
        /category[^>]*>([^<]+)</i,
      ];
      
      for (const pattern of categoryPatterns) {
        const match = html.match(pattern);
        if (match) {
          category = match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          break;
        }
      }

      // Extract video URL
      let videoUrl = '';
      const videoPatterns = [
        /<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i,
        /<iframe[^>]*src="([^"]*(?:youtube|vimeo)[^"]+)"/i,
        /data-video-url="([^"]+)"/i,
      ];
      
      for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match) {
          videoUrl = match[1];
          break;
        }
      }

      // Extract description from project content
      let description = '';
      const descriptionPatterns = [
        /<div[^>]*class="[^"]*full-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*project-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<section[^>]*class="[^"]*project-description[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
      ];
      
      for (const pattern of descriptionPatterns) {
        const match = html.match(pattern);
        if (match) {
          description = cleanHtml(match[1]).substring(0, 1000);
          if (description.length === 1000) description += '...';
          break;
        }
      }

      // Extract creator description
      let creatorDescription = '';
      const creatorPatterns = [
        /<div[^>]*class="[^"]*creator-bio[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<section[^>]*class="[^"]*creator[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
        /<div[^>]*class="[^"]*about-creator[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ];
      
      for (const pattern of creatorPatterns) {
        const match = html.match(pattern);
        if (match) {
          creatorDescription = cleanHtml(match[1]).substring(0, 500);
          if (creatorDescription.length === 500) creatorDescription += '...';
          break;
        }
      }

      // Extract rewards information
      const extractRewards = (html: string): KickstarterReward[] => {
        const rewards: KickstarterReward[] = [];
        
        // Look for reward sections in the HTML
        const rewardSectionPatterns = [
          /<div[^>]*class="[^"]*reward[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<section[^>]*class="[^"]*pledge[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
          /<div[^>]*data-reward-id[^>]*>([\s\S]*?)<\/div>/gi,
        ];
        
        for (const pattern of rewardSectionPatterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            const rewardHtml = match[1];
            
            // Extract reward title
            let title = '';
            const titlePatterns = [
              /<h3[^>]*>(.*?)<\/h3>/i,
              /<h4[^>]*>(.*?)<\/h4>/i,
              /<div[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/div>/i,
            ];
            
            for (const titlePattern of titlePatterns) {
              const titleMatch = rewardHtml.match(titlePattern);
              if (titleMatch) {
                title = cleanHtml(titleMatch[1]);
                break;
              }
            }
            
            // Extract reward price
            let price = 0;
            const pricePatterns = [
              /[\$¥€£]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
              /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[\$¥€£]/i,
              /pledge\s*[\$¥€£]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            ];
            
            for (const pricePattern of pricePatterns) {
              const priceMatch = rewardHtml.match(pricePattern);
              if (priceMatch) {
                price = extractCurrency(priceMatch[1]);
                break;
              }
            }
            
            // Extract reward description
            let description = '';
            const descPatterns = [
              /<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/i,
              /<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/i,
              /<p[^>]*>(.*?)<\/p>/i,
            ];
            
            for (const descPattern of descPatterns) {
              const descMatch = rewardHtml.match(descPattern);
              if (descMatch) {
                description = cleanHtml(descMatch[1]).substring(0, 300);
                if (description.length === 300) description += '...';
                break;
              }
            }
            
            // Extract estimated delivery
            let estimatedDelivery = '';
            const deliveryPatterns = [
              /delivery[^>]*(\d{4}年\d{1,2}月)/i,
              /estimated[^>]*(\d{4}年\d{1,2}月)/i,
              /(\d{4}年\d{1,2}月)[^>]*delivery/i,
              /delivery[^>]*(\w+\s+\d{4})/i,
              /estimated[^>]*(\w+\s+\d{4})/i,
            ];
            
            for (const deliveryPattern of deliveryPatterns) {
              const deliveryMatch = rewardHtml.match(deliveryPattern);
              if (deliveryMatch) {
                estimatedDelivery = deliveryMatch[1];
                break;
              }
            }
            
            // Extract backers count for this reward
            let backersCount = 0;
            const backersPatterns = [
              /(\d+)\s*backers?/i,
              /(\d+)\s*supporters?/i,
              /(\d+)\s*pledged/i,
            ];
            
            for (const backersPattern of backersPatterns) {
              const backersMatch = rewardHtml.match(backersPattern);
              if (backersMatch) {
                backersCount = extractNumber(backersMatch[1]);
                break;
              }
            }
            
            // Extract reward image
            let imageUrl = '';
            const imagePatterns = [
              /<img[^>]*src="([^"]+)"/i,
              /<div[^>]*style="[^"]*background-image:\s*url\(([^)]+)\)"/i,
            ];
            
            for (const imagePattern of imagePatterns) {
              const imageMatch = rewardHtml.match(imagePattern);
              if (imageMatch) {
                imageUrl = imageMatch[1].replace(/['"]/g, '');
                break;
              }
            }
            
            // Extract quantity available
            let quantityAvailable: number | undefined;
            const quantityPatterns = [
              /(\d+)\s*left/i,
              /(\d+)\s*remaining/i,
              /limited\s*(\d+)/i,
            ];
            
            for (const quantityPattern of quantityPatterns) {
              const quantityMatch = rewardHtml.match(quantityPattern);
              if (quantityMatch) {
                quantityAvailable = extractNumber(quantityMatch[1]);
                break;
              }
            }
            
            // Only add reward if it has essential information
            if (title && price > 0) {
              rewards.push({
                title,
                description,
                price,
                estimatedDelivery: estimatedDelivery || `${new Date().getFullYear() + 1}年${new Date().getMonth() + 1}月`,
                imageUrl: imageUrl || undefined,
                quantityAvailable,
                backersCount,
              });
            }
          }
        }
        
        return rewards;
      };
      
      const rewards = extractRewards(html);
      // Validate and set defaults
      return {
        title: title || 'Untitled Project',
        subtitle: subtitle || '',
        imageUrl: imageUrl || '',
        targetAmount: targetAmount || 0,
        currentAmount: currentAmount || 0,
        backersCount: backersCount || 0,
        category: category || 'Technology',
        description: description || '',
        creatorDescription: creatorDescription || '',
        videoUrl: videoUrl || undefined,
        rewards: rewards.length > 0 ? rewards : undefined,
      };
    };

    const scrapedData = extractData(html);

    // Validate extracted data
    if (!scrapedData.title || scrapedData.title === 'Untitled Project') {
      console.warn('Could not extract project title properly');
    }

    if (scrapedData.targetAmount === 0) {
      console.warn('Could not extract target amount');
    }

    console.log('Successfully scraped data:', {
      title: scrapedData.title,
      targetAmount: scrapedData.targetAmount,
      currentAmount: scrapedData.currentAmount,
      backersCount: scrapedData.backersCount,
      category: scrapedData.category,
      hasImage: !!scrapedData.imageUrl,
      hasVideo: !!scrapedData.videoUrl,
      descriptionLength: scrapedData.description.length,
      creatorDescriptionLength: scrapedData.creatorDescription.length,
    });

    return new Response(
      JSON.stringify({ success: true, data: scrapedData }),
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
        details: 'Failed to scrape Kickstarter data. Please check the URL and try again.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
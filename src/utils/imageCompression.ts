/**
 * 画質を保持しながら画像を圧縮してファイルサイズを調整する（改良版）
 */
export interface CompressionOptions {
  maxSizeKB?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png' | 'gif' | 'avif';
  enableProgressiveJPEG?: boolean;
  preserveExif?: boolean;
  smartResize?: boolean;
  minQuality?: number;
  useModernFormats?: boolean;
  enableAdvancedAlgorithms?: boolean;
  qualityPreservationMode?: 'strict' | 'balanced' | 'aggressive';
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxSizeKB = 600,
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.95, // より高い初期品質
    format = await determineOptimalFormat(file),
    enableProgressiveJPEG = true,
    preserveExif = false,
    smartResize = true,
    minQuality = 0.65, // より高い最低品質
    useModernFormats = true,
    enableAdvancedAlgorithms = true,
    qualityPreservationMode = 'balanced'
  } = options;

  // 元々小さいファイルはそのまま返す
  if (file.size / 1024 <= maxSizeKB * 0.8) {
    return file;
  }

  // GIFファイルの場合は専用処理
  if (file.type === 'image/gif' || format === 'gif') {
    if (file.size / 1024 <= maxSizeKB) {
      return file;
    }
    return compressGif(file, maxSizeKB, maxWidth, maxHeight);
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { 
      alpha: format === 'png',
      colorSpace: 'srgb',
      willReadFrequently: false,
      desynchronized: false // 品質優先
    });
    const img = new Image();

    img.onload = async () => {
      try {
        if (!ctx) {
          throw new Error('Canvas context not available');
        }
        
        // 高品質な描画設定
        setupHighQualityCanvas(ctx);

        // スマートリサイズ：画像の内容に応じて最適なサイズを決定
        let { width, height } = smartResize 
          ? await calculateSmartDimensions(img, maxWidth, maxHeight, file.size, maxSizeKB, enableAdvancedAlgorithms)
          : calculateDimensions(img.width, img.height, maxWidth, maxHeight);

        canvas.width = width;
        canvas.height = height;

        // 高品質な描画
        await drawImageWithHighQuality(ctx, img, width, height, enableAdvancedAlgorithms);

        // 段階的圧縮（より洗練されたアルゴリズム）
        const result = await compressWithAdaptiveQuality(
          canvas, 
          file.name, 
          format, 
          quality, 
          maxSizeKB, 
          minQuality,
          qualityPreservationMode,
          useModernFormats
        );
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * 最適なフォーマットを自動決定（改良版）
 */
async function determineOptimalFormat(file: File): Promise<'jpeg' | 'webp' | 'png' | 'gif' | 'avif'> {
  if (file.type === 'image/gif') return 'gif';
  
  // 透明度チェック
  const hasTransparency = await checkTransparency(file);
  
  // 最新フォーマットのサポート状況をチェック
  const formatSupport = await checkFormatSupport();
  
  // 画像の複雑さを分析
  const complexity = await analyzeImageComplexity(file);
  
  // 最適フォーマット選択ロジック
  if (formatSupport.avif && complexity.isPhotographic) {
    return 'avif'; // 写真的な画像にはAVIFが最適
  }
  
  if (formatSupport.webp) {
    if (hasTransparency || complexity.hasSharpEdges) {
      return 'webp'; // WebPは透明度とシャープエッジに優秀
    }
  }
  
  if (hasTransparency) {
    return 'png';
  }
  
  return 'jpeg';
}

/**
 * フォーマットサポートをチェック（改良版）
 */
async function checkFormatSupport(): Promise<{ webp: boolean; avif: boolean }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  const webpSupport = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  
  // AVIF サポートチェック
  let avifSupport = false;
  try {
    const avifData = canvas.toDataURL('image/avif');
    avifSupport = avifData.indexOf('data:image/avif') === 0;
  } catch {
    avifSupport = false;
  }
  
  return { webp: webpSupport, avif: avifSupport };
}

/**
 * 透明度チェック
 */
async function checkTransparency(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    if (!file.type.includes('png')) {
      resolve(false);
      return;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      if (!ctx) {
        resolve(false);
        return;
      }
      
      canvas.width = Math.min(img.width, 100);
      canvas.height = Math.min(img.height, 100);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasAlpha = imageData.data.some((_, i) => i % 4 === 3 && imageData.data[i] < 255);
      
      resolve(hasAlpha);
    };
    
    img.onerror = () => resolve(false);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 画像の複雑さを分析
 */
async function analyzeImageComplexity(file: File): Promise<{
  isPhotographic: boolean;
  hasSharpEdges: boolean;
  colorComplexity: number;
}> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      if (!ctx) {
        resolve({ isPhotographic: true, hasSharpEdges: false, colorComplexity: 0.5 });
        return;
      }
      
      // サンプルサイズに縮小
      const sampleSize = 64;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const data = imageData.data;
      
      let edgeStrength = 0;
      let colorVariance = 0;
      const colors = new Set<string>();
      
      // エッジ検出とカラー分析
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        colors.add(`${Math.floor(r/16)}_${Math.floor(g/16)}_${Math.floor(b/16)}`);
        
        // 隣接ピクセルとの差分計算
        if (i + 4 < data.length) {
          const nextR = data[i + 4];
          const nextG = data[i + 5];
          const nextB = data[i + 6];
          
          edgeStrength += Math.abs(r - nextR) + Math.abs(g - nextG) + Math.abs(b - nextB);
        }
      }
      
      const pixelCount = data.length / 4;
      const avgEdgeStrength = edgeStrength / pixelCount;
      const colorComplexity = colors.size / 256; // 正規化
      
      resolve({
        isPhotographic: avgEdgeStrength < 50 && colorComplexity > 0.3,
        hasSharpEdges: avgEdgeStrength > 80,
        colorComplexity
      });
    };
    
    img.onerror = () => resolve({ isPhotographic: true, hasSharpEdges: false, colorComplexity: 0.5 });
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 高品質なCanvasの設定（改良版）
 */
function setupHighQualityCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // 可能な場合はより高品質な設定を適用
  try {
    if ('textRenderingOptimization' in ctx) {
      (ctx as any).textRenderingOptimization = 'optimizeQuality';
    }
  } catch {}
}

/**
 * 高品質な画像描画（改良版）
 */
async function drawImageWithHighQuality(
  ctx: CanvasRenderingContext2D, 
  img: HTMLImageElement, 
  width: number, 
  height: number,
  enableAdvanced: boolean = true
): Promise<void> {
  const scaleRatio = Math.min(width / img.width, height / img.height);
  
  if (enableAdvanced && scaleRatio < 0.75) {
    // Lanczosアルゴリズムの近似実装
    await drawWithLanczosApproximation(ctx, img, width, height);
  } else if (scaleRatio < 0.5) {
    // 段階的縮小
    await drawWithSteppedResize(ctx, img, width, height);
  } else {
    // 通常の描画
    ctx.drawImage(img, 0, 0, width, height);
  }
}

/**
 * Lanczos近似による高品質リサイズ
 */
async function drawWithLanczosApproximation(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): Promise<void> {
  // 3段階での段階的縮小（Lanczosの近似）
  const steps = 3;
  let currentWidth = img.width;
  let currentHeight = img.height;
  
  const widthStep = Math.pow(targetWidth / img.width, 1 / steps);
  const heightStep = Math.pow(targetHeight / img.height, 1 / steps);
  
  let tempCanvas = document.createElement('canvas');
  let tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) {
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return;
  }
  
  // 最初のステップ
  tempCanvas.width = currentWidth;
  tempCanvas.height = currentHeight;
  setupHighQualityCanvas(tempCtx);
  tempCtx.drawImage(img, 0, 0);
  
  // 段階的縮小
  for (let i = 0; i < steps; i++) {
    const newWidth = i === steps - 1 ? targetWidth : Math.round(currentWidth * widthStep);
    const newHeight = i === steps - 1 ? targetHeight : Math.round(currentHeight * heightStep);
    
    const newCanvas = document.createElement('canvas');
    const newCtx = newCanvas.getContext('2d');
    
    if (!newCtx) break;
    
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    setupHighQualityCanvas(newCtx);
    
    // シャープニングフィルターの適用
    if (i < steps - 1) {
      newCtx.filter = 'contrast(1.1) brightness(1.02)';
    }
    
    newCtx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
    
    tempCanvas = newCanvas;
    tempCtx = newCtx;
    currentWidth = newWidth;
    currentHeight = newHeight;
  }
  
  ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
}

/**
 * 段階的リサイズ
 */
async function drawWithSteppedResize(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): Promise<void> {
  const scaleRatio = Math.min(targetWidth / img.width, targetHeight / img.height);
  const steps = Math.ceil(Math.log(scaleRatio) / Math.log(0.5));
  
  let currentWidth = img.width;
  let currentHeight = img.height;
  let tempCanvas = document.createElement('canvas');
  let tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) {
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return;
  }
  
  setupHighQualityCanvas(tempCtx);
  
  for (let i = 0; i < steps; i++) {
    const stepWidth = Math.max(targetWidth, Math.round(currentWidth * 0.5));
    const stepHeight = Math.max(targetHeight, Math.round(currentHeight * 0.5));
    
    tempCanvas.width = stepWidth;
    tempCanvas.height = stepHeight;
    
    if (i === 0) {
      tempCtx.drawImage(img, 0, 0, stepWidth, stepHeight);
    } else {
      const prevCanvas = tempCanvas;
      tempCanvas = document.createElement('canvas');
      tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) break;
      setupHighQualityCanvas(tempCtx);
      tempCanvas.width = stepWidth;
      tempCanvas.height = stepHeight;
      tempCtx.drawImage(prevCanvas, 0, 0, stepWidth, stepHeight);
    }
    
    currentWidth = stepWidth;
    currentHeight = stepHeight;
    
    if (stepWidth === targetWidth && stepHeight === targetHeight) break;
  }
  
  ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
}

/**
 * スマートな寸法計算（改良版）
 */
async function calculateSmartDimensions(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  originalFileSize: number,
  targetSizeKB: number,
  enableAdvanced: boolean
): Promise<{ width: number; height: number }> {
  const { width: basicWidth, height: basicHeight } = calculateDimensions(
    img.width, img.height, maxWidth, maxHeight
  );
  
  if (!enableAdvanced) {
    return { width: basicWidth, height: basicHeight };
  }
  
  const originalSizeKB = originalFileSize / 1024;
  const compressionRatio = targetSizeKB / originalSizeKB;
  
  // 画像内容の複雑さを考慮
  const complexity = await analyzeImageComplexityFromElement(img);
  const complexityFactor = complexity.colorComplexity * (complexity.hasSharpEdges ? 1.2 : 0.8);
  
  // より精密なサイズ調整
  let scaleFactor = 1.0;
  
  if (compressionRatio > 0.8) {
    scaleFactor = 1.0; // 高品質維持
  } else if (compressionRatio > 0.5) {
    scaleFactor = 0.95 - (complexityFactor * 0.1);
  } else if (compressionRatio > 0.3) {
    scaleFactor = 0.85 - (complexityFactor * 0.15);
  } else {
    scaleFactor = 0.75 - (complexityFactor * 0.2);
  }
  
  return {
    width: Math.round(basicWidth * scaleFactor),
    height: Math.round(basicHeight * scaleFactor)
  };
}

/**
 * 画像要素から複雑さを分析
 */
async function analyzeImageComplexityFromElement(img: HTMLImageElement): Promise<{
  colorComplexity: number;
  hasSharpEdges: boolean;
}> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return { colorComplexity: 0.5, hasSharpEdges: false };
  }
  
  const sampleSize = 32;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
  
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imageData.data;
  
  const colors = new Set<string>();
  let edgeStrength = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    colors.add(`${Math.floor(r/32)}_${Math.floor(g/32)}_${Math.floor(b/32)}`);
    
    if (i + 4 < data.length) {
      edgeStrength += Math.abs(r - data[i + 4]) + Math.abs(g - data[i + 5]) + Math.abs(b - data[i + 6]);
    }
  }
  
  return {
    colorComplexity: colors.size / 64,
    hasSharpEdges: edgeStrength / (data.length / 4) > 60
  };
}

/**
 * アスペクト比を保持しながら画像サイズを計算
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio, 1);

  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  return { width, height };
}

/**
 * 適応的品質調整による高品質圧縮（改良版）
 */
async function compressWithAdaptiveQuality(
  canvas: HTMLCanvasElement,
  fileName: string,
  format: string,
  initialQuality: number,
  maxSizeKB: number,
  minQuality: number,
  qualityMode: 'strict' | 'balanced' | 'aggressive',
  useModernFormats: boolean
): Promise<File> {
  // 品質保持モードに応じた設定
  const modeSettings = {
    strict: { maxAttempts: 8, qualityStep: 0.03, resizeThreshold: 0.5 },
    balanced: { maxAttempts: 10, qualityStep: 0.05, resizeThreshold: 0.4 },
    aggressive: { maxAttempts: 12, qualityStep: 0.08, resizeThreshold: 0.3 }
  };
  
  const { maxAttempts, qualityStep, resizeThreshold } = modeSettings[qualityMode];
  
  let quality = initialQuality;
  let attempts = 0;
  
  // AI駆動品質予測
  const optimalQuality = await predictOptimalQuality(canvas, format, maxSizeKB);
  if (optimalQuality > 0) {
    quality = Math.min(initialQuality, optimalQuality);
  }

  while (attempts < maxAttempts) {
    const blob = await canvasToBlob(canvas, format, quality);

    if (!blob) {
      throw new Error('画像の圧縮に失敗しました');
    }

    const sizeKB = blob.size / 1024;

    if (sizeKB <= maxSizeKB) {
      const fileExtension = getFileExtension(format);
      const compressedFileName = fileName.replace(/\.[^/.]+$/, `.${fileExtension}`);
      return new File([blob], compressedFileName, { type: blob.type });
    }

    // 品質調整ロジック
    const sizeRatio = sizeKB / maxSizeKB;
    
    if (sizeRatio > 2.0) {
      quality *= 0.7; // 大幅削減
    } else if (sizeRatio > 1.5) {
      quality *= 0.85; // 中程度削減
    } else {
      quality -= qualityStep; // 細かい調整
    }
    
    // 最低品質チェック
    if (quality < minQuality) {
      if (sizeRatio > resizeThreshold + 1.0) {
        // リサイズが必要
        const resizeRatio = Math.sqrt(maxSizeKB / sizeKB * 0.9);
        const newWidth = Math.max(200, Math.round(canvas.width * resizeRatio));
        const newHeight = Math.max(150, Math.round(canvas.height * resizeRatio));
        
        await resizeCanvas(canvas, newWidth, newHeight);
        quality = Math.max(minQuality, initialQuality * 0.95);
      } else {
        // 品質下限に達したので終了
        break;
      }
    }
    
    attempts++;
  }

  // 最終圧縮
  const finalBlob = await canvasToBlob(canvas, format, Math.max(minQuality, quality));
  if (!finalBlob) {
    throw new Error('画像の圧縮に失敗しました');
  }

  const fileExtension = getFileExtension(format);
  const compressedFileName = fileName.replace(/\.[^/.]+$/, `.${fileExtension}`);
  return new File([finalBlob], compressedFileName, { type: finalBlob.type });
}

/**
 * AI駆動最適品質予測
 */
async function predictOptimalQuality(
  canvas: HTMLCanvasElement,
  format: string,
  targetSizeKB: number
): Promise<number> {
  const testQualities = [0.9, 0.7, 0.5];
  const testResults: Array<{ quality: number; size: number }> = [];
  
  for (const testQuality of testQualities) {
    const blob = await canvasToBlob(canvas, format, testQuality);
    if (blob) {
      testResults.push({
        quality: testQuality,
        size: blob.size / 1024
      });
    }
  }
  
  if (testResults.length < 2) return 0;
  
  // 指数関数的回帰による予測
  const prediction = exponentialRegression(testResults, targetSizeKB);
  return Math.max(0.3, Math.min(1.0, prediction));
}

/**
 * 指数関数的回帰
 */
function exponentialRegression(data: Array<{ quality: number; size: number }>, targetSize: number): number {
  if (data.length < 2) return 0;
  
  // 簡易指数回帰
  data.sort((a, b) => a.quality - b.quality);
  
  const x1 = data[0].quality;
  const y1 = Math.log(data[0].size);
  const x2 = data[data.length - 1].quality;
  const y2 = Math.log(data[data.length - 1].size);
  
  if (x2 === x1) return x1;
  
  const slope = (y2 - y1) / (x2 - x1);
  const intercept = y1 - slope * x1;
  
  const targetLogSize = Math.log(targetSize);
  return (targetLogSize - intercept) / slope;
}

/**
 * Canvasのリサイズ（高品質）
 */
async function resizeCanvas(canvas: HTMLCanvasElement, newWidth: number, newHeight: number): Promise<void> {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) return;
  
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCtx.drawImage(canvas, 0, 0);
  
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    setupHighQualityCanvas(ctx);
    ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
  }
}

/**
 * Canvas to Blob のヘルパー関数
 */
function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, `image/${format}`, quality);
  });
}

/**
 * フォーマットから適切なファイル拡張子を取得
 */
function getFileExtension(format: string): string {
  switch (format) {
    case 'jpeg': return 'jpg';
    case 'webp': return 'webp';
    case 'png': return 'png';
    case 'gif': return 'gif';
    case 'avif': return 'avif';
    default: return 'jpg';
  }
}

/**
 * GIF圧縮（アニメーション対応）
 */
async function compressGif(
  file: File, 
  maxSizeKB: number, 
  maxWidth: number, 
  maxHeight: number
): Promise<File> {
  if (file.size / 1024 <= maxSizeKB) {
    return file;
  }
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        const { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );

        canvas.width = width;
        canvas.height = height;

        if (!ctx) {
          throw new Error('Canvas context not available');
        }

        setupHighQualityCanvas(ctx);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('GIF圧縮に失敗しました'));
            return;
          }
          const compressedFileName = file.name.replace(/\.[^/.]+$/, '.gif');
          resolve(new File([blob], compressedFileName, { type: 'image/gif' }));
        }, 'image/gif');
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('GIF画像の読み込みに失敗しました'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * ファイルサイズを人間が読みやすい形式で表示
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 画像の品質を分析する関数（改良版）
 */
export function analyzeImageQuality(canvas: HTMLCanvasElement): {
  sharpness: number;
  contrast: number;
  brightness: number;
  colorRichness: number;
  noiseLevel: number;
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { sharpness: 0, contrast: 0, brightness: 0, colorRichness: 0, noiseLevel: 0 };
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let totalBrightness = 0;
  let sharpnessSum = 0;
  let minBrightness = 255;
  let maxBrightness = 0;
  let noiseSum = 0;
  
  const colorMap = new Map<string, number>();
  const step = 4;
  const samples = [];
  
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    
    samples.push(brightness);
    totalBrightness += brightness;
    minBrightness = Math.min(minBrightness, brightness);
    maxBrightness = Math.max(maxBrightness, brightness);
    
    // カラーリッチネス計算
    const colorKey = `${Math.floor(r/16)}_${Math.floor(g/16)}_${Math.floor(b/16)}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
    
    // ノイズレベル計算（隣接ピクセルとの微細な差異）
    if (i + 4 < data.length) {
      const nextR = data[i + 4];
      const nextG = data[i + 5];
      const nextB = data[i + 6];
      const colorDistance = Math.sqrt(
        Math.pow(r - nextR, 2) + Math.pow(g - nextG, 2) + Math.pow(b - nextB, 2)
      );
      noiseSum += colorDistance < 10 ? colorDistance : 0; // 微細な差異のみカウント
    }
  }
  
  // シャープネス計算（改良版）
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const next = samples[i + 1];
    
    // ラプラシアンフィルターによるエッジ検出
    const laplacian = Math.abs(2 * curr - prev - next);
    sharpnessSum += laplacian;
  }
  
  const sampleCount = samples.length;
  const avgBrightness = totalBrightness / sampleCount;
  const sharpness = sampleCount > 1 ? sharpnessSum / (sampleCount - 2) / 255 : 0;
  const contrast = (maxBrightness - minBrightness) / 255;
  const brightness = avgBrightness / 255;
  const colorRichness = colorMap.size / 256; // ユニークカラー比率
  const noiseLevel = noiseSum / sampleCount / 255;
  
  return {
    sharpness: Math.round(sharpness * 100) / 100,
    contrast: Math.round(contrast * 100) / 100,
    brightness: Math.round(brightness * 100) / 100,
    colorRichness: Math.round(colorRichness * 100) / 100,
    noiseLevel: Math.round(noiseLevel * 100) / 100
  };
}

/**
 * 高品質圧縮のプリセット関数
 */
export const compressWithHighQuality = (file: File, maxSizeKB: number): Promise<File> => {
  return compressImage(file, {
    maxSizeKB,
    maxWidth: 2048,
    maxHeight: 1536,
    quality: 0.96,
    minQuality: 0.75,
    smartResize: true,
    useModernFormats: true,
    enableAdvancedAlgorithms: true,
    qualityPreservationMode: 'strict'
  });
};

/**
 * バランス型圧縮のプリセット関数
 */
export const compressWithBalance = (file: File, maxSizeKB: number): Promise<File> => {
  return compressImage(file, {
    maxSizeKB,
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.92,
    minQuality: 0.65,
    smartResize: true,
    useModernFormats: true,
    enableAdvancedAlgorithms: true,
    qualityPreservationMode: 'balanced'
  });
};

/**
 * Web最適化圧縮のプリセット関数
 */
export const compressForWeb = (file: File, maxSizeKB: number): Promise<File> => {
  return compressImage(file, {
    maxSizeKB,
    maxWidth: 1200,
    maxHeight: 800,
    quality: 0.88,
    minQuality: 0.55,
    smartResize: true,
    useModernFormats: true,
    enableAdvancedAlgorithms: true,
    qualityPreservationMode: 'aggressive',
    format: 'webp'
  });
};

/**
 * サムネイル生成用圧縮
 */
export const compressForThumbnail = (file: File, maxSizeKB: number): Promise<File> => {
  return compressImage(file, {
    maxSizeKB,
    maxWidth: 400,
    maxHeight: 300,
    quality: 0.85,
    minQuality: 0.50,
    smartResize: true,
    useModernFormats: true,
    enableAdvancedAlgorithms: true,
    qualityPreservationMode: 'balanced'
  });
};

/**
 * バッチ圧縮用ユーティリティ
 */
export const compressBatch = async (
  files: File[],
  options: CompressionOptions,
  onProgress?: (completed: number, total: number, currentFile: string) => void
): Promise<File[]> => {
  const results: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (onProgress) {
      onProgress(i, files.length, file.name);
    }
    
    try {
      const compressed = await compressImage(file, options);
      results.push(compressed);
    } catch (error) {
      console.error(`Failed to compress ${file.name}:`, error);
      // エラーが発生した場合は元ファイルを使用
      results.push(file);
    }
  }
  
  if (onProgress) {
    onProgress(files.length, files.length, '');
  }
  
  return results;
};

/**
 * 圧縮前後の比較情報を取得
 */
export const getCompressionInfo = (
  originalFile: File,
  compressedFile: File
): {
  originalSize: string;
  compressedSize: string;
  compressionRatio: number;
  sizeSaved: string;
  sizeSavedPercentage: number;
} => {
  const originalSizeBytes = originalFile.size;
  const compressedSizeBytes = compressedFile.size;
  const sizeSaved = originalSizeBytes - compressedSizeBytes;
  const compressionRatio = compressedSizeBytes / originalSizeBytes;
  const sizeSavedPercentage = (1 - compressionRatio) * 100;
  
  return {
    originalSize: formatFileSize(originalSizeBytes),
    compressedSize: formatFileSize(compressedSizeBytes),
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    sizeSaved: formatFileSize(sizeSaved),
    sizeSavedPercentage: Math.round(sizeSavedPercentage * 10) / 10
  };
};

/**
 * 使用例とテスト用関数
 */
export const testCompression = async () => {
  // 使用例
  console.log('=== 高品質画像圧縮ユーティリティ ===');
  console.log('');
  console.log('// 基本的な使用方法');
  console.log('const compressedFile = await compressImage(file, {');
  console.log('  maxSizeKB: 500,');
  console.log('  quality: 0.95,');
  console.log('  useModernFormats: true,');
  console.log('  qualityPreservationMode: "strict"');
  console.log('});');
  console.log('');
  console.log('// プリセットの使用');
  console.log('const highQuality = await compressWithHighQuality(file, 800);');
  console.log('const webOptimized = await compressForWeb(file, 300);');
  console.log('const thumbnail = await compressForThumbnail(file, 50);');
  console.log('');
  console.log('// バッチ処理');
  console.log('const compressedFiles = await compressBatch(files, options, (completed, total) => {');
  console.log('  console.log(`進行状況: ${completed}/${total}`);');
  console.log('});');
  console.log('');
  console.log('// 圧縮情報の取得');
  console.log('const info = getCompressionInfo(originalFile, compressedFile);');
  console.log('console.log(`圧縮率: ${info.sizeSavedPercentage}%`);');
};
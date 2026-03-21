import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Save, X, Upload, Image as ImageIcon, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Reward, RewardVariant } from '../types/reward';
import { compressImage } from '../utils/imageCompression';

interface RewardFormProps {
  projectId: string;
  reward?: Reward | null;
  duplicateReward?: Reward | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function RewardForm({ projectId, reward, duplicateReward, onSave, onCancel }: RewardFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    estimated_delivery_year: new Date().getFullYear(),
    estimated_delivery_month: new Date().getMonth() + 1,
    quantity_available: null as number | null,
    image_url: '',
    is_available: true,
    sort_order: 0,
    link_url: '',
    variants: [] as RewardVariant[],
  });
  const [loading, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [showVariants, setShowVariants] = useState(false);

  useEffect(() => {
    const sourceReward = reward || duplicateReward;
    if (sourceReward) {
      // お届け予定の年月を分離
      let year = new Date().getFullYear();
      let month = new Date().getMonth() + 1;
      
      if (sourceReward.estimated_delivery) {
        // 英語形式 "January 2025" または日本語形式 "2025年1月" の両方に対応
        const englishMatch = sourceReward.estimated_delivery.match(/(\w+)\s+(\d{4})/);
        const japaneseMatch = sourceReward.estimated_delivery.match(/(\d{4})年(\d{1,2})月/);
        
        if (japaneseMatch) {
          year = parseInt(japaneseMatch[1]);
          month = parseInt(japaneseMatch[2]);
        } else if (englishMatch) {
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          const monthIndex = monthNames.indexOf(englishMatch[1]);
          if (monthIndex !== -1) {
            month = monthIndex + 1;
            year = parseInt(englishMatch[2]);
          }
        }
      }

      setFormData({
        title: duplicateReward ? `${sourceReward.title} (コピー)` : sourceReward.title,
        description: sourceReward.description || '',
        price: sourceReward.price,
        estimated_delivery_year: year,
        estimated_delivery_month: month,
        quantity_available: sourceReward.quantity_available,
        image_url: sourceReward.image_url || '',
        is_available: sourceReward.is_available,
        sort_order: duplicateReward ? sourceReward.sort_order + 1 : sourceReward.sort_order,
        link_url: sourceReward.link_url || '',
        variants: sourceReward.variants || [],
      });
      setShowVariants((sourceReward.variants || []).length > 0);
    }
  }, [reward, duplicateReward]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? null : Number(value)) : 
               type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { size: '', color: '', stock: 0, sku: '' }]
    }));
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariant = (index: number, field: keyof RewardVariant, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) => 
        i === index ? { ...variant, [field]: value } : variant
      )
    }));
  };

  const handleImageUpload = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error('画像ファイルのみアップロード可能です');
    return;
  }

  setImageUploading(true);
  try {
    // 画像を3:2の比率で500KB以下に自動圧縮
    const compressedFile = await compressImage(file, {
      maxSizeKB: 600,
      maxWidth: 1800,
      maxHeight: 1200,  // 1800 × 2/3 = 1200 (3:2の比率)
      quality: 0.95,
      format: file.type.includes('gif') ? 'gif' : 'jpeg',
      aspectRatio: 3 / 2,  // 3:2の比率を指定
    });

    // 以下は既存のコードと同じ
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileExtension = file.type.includes('gif') ? 'gif' : 'jpg';
    const fileName = `rewards/reward-${timestamp}-${randomId}.${fileExtension}`;
    
    const { error: uploadError } = await supabase.storage
      .from('project-images')
      .upload(fileName, compressedFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('project-images')
      .getPublicUrl(fileName);

    setFormData(prev => ({ ...prev, image_url: publicUrl }));
    
    // 圧縮結果を表示
    const originalSizeKB = Math.round(file.size / 1024);
    const compressedSizeKB = Math.round(compressedFile.size / 1024);
    const compressionRatio = file.size > compressedFile.size 
      ? Math.round((1 - compressedFile.size / file.size) * 100)
      : 0;
    
    if (file.type.includes('gif')) {
      toast.success(
        `GIF画像をアップロードしました (3:2比率)\n` +
        `ファイルサイズ: ${compressedSizeKB}KB`
      );
    } else {
      toast.success(
        `画像をアップロードしました (3:2比率)\n` +
        `元サイズ: ${originalSizeKB}KB → 圧縮後: ${compressedSizeKB}KB (${compressionRatio}% 削減)`
      );
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    toast.error(`画像のアップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  } finally {
    setImageUploading(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('リターンタイトルを入力してください');
      return;
    }

    if (formData.price < 0) {
      toast.error('価格は0以上で入力してください');
      return;
    }

    setSaving(true);
    try {
      // お届け予定を文字列に変換
      const estimatedDelivery = `${formData.estimated_delivery_year}年${formData.estimated_delivery_month}月`;

      const dataToSave = {
        project_id: projectId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        price: formData.price,
        estimated_delivery: estimatedDelivery,
        quantity_available: formData.quantity_available,
        image_url: formData.image_url || null,
        is_available: formData.is_available,
        sort_order: formData.sort_order,
        link_url: formData.link_url.trim() || null,
        variants: formData.variants,
      };

      if (reward && !duplicateReward) {
        const { error } = await supabase
          .from('rewards')
          .update(dataToSave)
          .eq('id', reward.id);
        
        if (error) throw error;
        toast.success('リターンを更新しました');
      } else {
        // 新規作成または複製の場合
        const { error } = await supabase
          .from('rewards')
          .insert([dataToSave]);
        
        if (error) throw error;
        toast.success(duplicateReward ? 'リターンを複製しました' : 'リターンを追加しました');
      }

      onSave();
    } catch (error) {
      console.error('Error saving reward:', error);
      toast.error('リターンの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {reward ? 'リターンを編集' : duplicateReward ? 'リターンを複製' : '新しいリターンを追加'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              リターンタイトル *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="例: 早期支援者限定セット"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              詳細説明
            </label>
            <div className="mt-1">
              <div className="relative border-2 border-gray-200 rounded-xl overflow-hidden transition-all duration-200 focus-within:border-purple-400 focus-within:shadow-lg focus-within:shadow-purple-100">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-150"
                          title="太字"
                        >
                          <strong className="text-sm font-bold">B</strong>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-150"
                          title="斜体"
                        >
                          <em className="text-sm font-medium">I</em>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-150"
                          title="リスト"
                        >
                          <span className="text-sm font-bold">•</span>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-150"
                          title="特典"
                        >
                          <span className="text-sm">🎁</span>
                        </button>
                      </div>
                      <div className="h-6 w-px bg-gray-300"></div>
                      <span className="text-sm text-gray-600 font-medium">リターンの魅力を伝える</span>
                    </div>
                    <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                      {formData.description.length} 文字
                    </div>
                  </div>
                </div>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="block w-full border-0 resize-none focus:ring-0 focus:outline-none p-6 text-base placeholder-gray-400 bg-white leading-relaxed"
                  placeholder="支援者が魅力を感じるリターンの説明を書きましょう！&#10;&#10;✨ 含まれるもの：&#10;• メイン商品の詳細&#10;• 特典やボーナス&#10;• 限定要素&#10;&#10;📦 商品の特徴：&#10;• 素材や品質について&#10;• サイズや仕様&#10;• 使い方のポイント&#10;&#10;🚚 お届けについて：&#10;• 配送方法&#10;• 注意事項"
                />
                <div className="bg-gradient-to-r from-gray-50 to-purple-50 px-4 py-3 border-t border-gray-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 flex items-center">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      魅力的な説明で支援者の心を掴みましょう
                    </span>
                    <span className="text-gray-400 bg-white px-2 py-1 rounded-full">詳細に書くほど支援率UP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                価格 (円) *
              </label>
              <input
                type="number"
                id="price"
                name="price"
                min="0"
                value={formData.price}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="quantity_available" className="block text-sm font-medium text-gray-700">
                数量制限
              </label>
              <input
                type="number"
                id="quantity_available"
                name="quantity_available"
                min="1"
                value={formData.quantity_available || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="制限なしの場合は空欄"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                お届け予定年
              </label>
              <select
                name="estimated_delivery_year"
                value={formData.estimated_delivery_year}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() + i;
                  return (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                お届け予定月
              </label>
              <select
                name="estimated_delivery_month"
                value={formData.estimated_delivery_month}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = i + 1;
                  return (
                    <option key={month} value={month}>
                      {month}月
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="quantity_available" className="block text-sm font-medium text-gray-700">
              数量制限
            </label>
            <input
              type="number"
              id="quantity_available"
              name="quantity_available"
              min="1"
              value={formData.quantity_available || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="制限なしの場合は空欄"
            />
          </div>

          <div>
            <div>
              <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700">
                表示順序
              </label>
              <input
                type="number"
                id="sort_order"
                name="sort_order"
                min="0"
                value={formData.sort_order}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              リターン画像
            </label>
            <div className="text-xs text-gray-500 mb-2">
              ※ 画像は自動的に600KB以下に高画質圧縮されます（推奨サイズ: 1800×1400px以下）<br />
              ※ GIF画像はアニメーション保持のため、サイズが大きい場合のみリサイズされます
            </div>
            <div className="flex items-center space-x-4">
              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Upload className="w-4 h-4 mr-2" />
                {imageUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                    圧縮・アップロード中...
                  </>
                ) : (
                  '画像を選択'
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="hidden"
                  disabled={imageUploading}
                />
              </label>
              
              {formData.image_url && (
                <div className="flex items-center space-x-2">
                  <div className="relative">
                  <img
                    src={formData.image_url}
                    alt="リターン画像"
                      className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                  />
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full">
                      ✓
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                    className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded-full transition-colors"
                    title="画像を削除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            {imageUploading && (
              <div className="mt-2 text-xs text-gray-500">
                <div className="flex items-center">
                  <div className="animate-pulse w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                  画像を最適化しています...
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="link_url" className="block text-sm font-medium text-gray-700">
              リターン専用リンク (オプション)
            </label>
            <input
              type="url"
              id="link_url"
              name="link_url"
              value={formData.link_url}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="https://kickstarter.com/projects/example/rewards/123456"
            />
            <p className="mt-1 text-xs text-gray-500">
              このリターン専用のリンクを設定できます。空欄の場合はプロジェクトのメインリンクが使用されます。
            </p>
          </div>

          {/* バリエーション設定 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                サイズ・色のバリエーション
              </label>
              <button
                type="button"
                onClick={() => setShowVariants(!showVariants)}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {showVariants ? 'バリエーションを隠す' : 'バリエーションを設定'}
              </button>
            </div>
            
            {showVariants && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    サイズや色などのバリエーションを設定できます。在庫数も個別に管理できます。
                  </p>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                  >
                    バリエーション追加
                  </button>
                </div>

                {formData.variants.map((variant, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        サイズ
                      </label>
                      <select
                        value={variant.size || ''}
                        onChange={(e) => updateVariant(index, 'size', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">選択してください</option>
                        <option value="XS">XS</option>
                        <option value="S">S</option>
                        <option value="M">M</option>
                        <option value="L">L</option>
                        <option value="XL">XL</option>
                        <option value="XXL">XXL</option>
                        <option value="フリーサイズ">フリーサイズ</option>
                        <option value="その他">その他</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        色
                      </label>
                      <input
                        type="text"
                        value={variant.color || ''}
                        onChange={(e) => updateVariant(index, 'color', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="例: 赤、青、黒"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        在庫数
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={variant.stock}
                        onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        SKU (任意)
                      </label>
                      <input
                        type="text"
                        value={variant.sku || ''}
                        onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="商品コード"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="w-full px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}

                {formData.variants.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    バリエーションが設定されていません。「バリエーション追加」ボタンから追加してください。
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_available"
              name="is_available"
              checked={formData.is_available}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="is_available" className="ml-2 block text-sm text-gray-900">
              このリターンを有効にする
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
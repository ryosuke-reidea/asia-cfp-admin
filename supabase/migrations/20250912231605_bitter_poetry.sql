/*
  # リターンにサイズ・色のバリエーション機能を追加

  1. テーブル変更
    - `rewards`テーブルに`variants`カラム（JSONB）を追加
    - バリエーション情報（サイズ、色、在庫数など）を格納

  2. バリエーション構造
    - サイズ: XS, S, M, L, XL, フリーサイズなど
    - 色: 赤, 青, 黒, 白など
    - 各バリエーションごとの在庫数

  3. 既存データの互換性
    - 既存のリターンは空のバリエーション配列でデフォルト設定
*/

-- リターンテーブルにバリエーション情報を追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'variants'
  ) THEN
    ALTER TABLE rewards ADD COLUMN variants JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- バリエーション情報のインデックスを追加（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_rewards_variants ON rewards USING GIN (variants);

-- バリエーション情報の制約を追加（データ整合性のため）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'rewards_variants_check'
  ) THEN
    ALTER TABLE rewards ADD CONSTRAINT rewards_variants_check 
    CHECK (jsonb_typeof(variants) = 'array');
  END IF;
END $$;

-- 既存のリターンにデフォルトのバリエーション情報を設定
UPDATE rewards 
SET variants = '[]'::jsonb 
WHERE variants IS NULL;

-- バリエーション情報を扱うヘルパー関数を作成
CREATE OR REPLACE FUNCTION get_reward_total_stock(reward_variants JSONB)
RETURNS INTEGER AS $$
DECLARE
  variant JSONB;
  total_stock INTEGER := 0;
BEGIN
  -- バリエーションが空の場合は0を返す
  IF jsonb_array_length(reward_variants) = 0 THEN
    RETURN 0;
  END IF;

  -- 各バリエーションの在庫数を合計
  FOR variant IN SELECT jsonb_array_elements(reward_variants)
  LOOP
    total_stock := total_stock + COALESCE((variant->>'stock')::INTEGER, 0);
  END LOOP;

  RETURN total_stock;
END;
$$ LANGUAGE plpgsql;

-- バリエーション情報の例（コメントとして記載）
/*
variants JSONBの構造例:
[
  {
    "size": "M",
    "color": "赤",
    "stock": 10,
    "sku": "REWARD001-M-RED"
  },
  {
    "size": "L", 
    "color": "青",
    "stock": 5,
    "sku": "REWARD001-L-BLUE"
  }
]
*/
ALTER TABLE projects 
ADD COLUMN external_achievement_rate DECIMAL(5,2);
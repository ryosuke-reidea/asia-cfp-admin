/*
  # プロジェクトテーブルに外部サービス用カラムを追加

  1. 新しいカラム
    - `external_amount_achieved` (integer) - 外部サービスでの達成金額
    - `external_buyers_count` (integer) - 外部サービスでの購入者数
    - `external_achievement_rate` (integer) - 外部サービスでの達成率

  2. 既存カラムの役割変更
    - `amount_achieved` - 内部予約システムでの達成金額（トリガーで自動更新）
    - `buyers_count` - 内部予約システムでの購入者数（トリガーで自動更新）
    - `achievement_rate` - 内部予約システムでの達成率（トリガーで自動更新）

  3. 表示用の合計値は計算で求める
*/

-- 外部サービス用のカラムを追加
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS external_amount_achieved integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS external_buyers_count integer DEFAULT 0,

-- 既存データの移行（現在のamount_achievedとbuyers_countを外部データとして保存）
UPDATE projects 
SET 
  external_amount_achieved = amount_achieved,
  external_buyers_count = buyers_count,
  external_achievement_rate = achievement_rate,
  amount_achieved = 0,
  buyers_count = 0,
  achievement_rate = 0
WHERE external_amount_achieved IS NULL;

-- コメントを追加
COMMENT ON COLUMN projects.amount_achieved IS '内部予約システムでの達成金額（トリガーで自動更新）';
COMMENT ON COLUMN projects.buyers_count IS '内部予約システムでの購入者数（トリガーで自動更新）';
COMMENT ON COLUMN projects.achievement_rate IS '内部予約システムでの達成率（トリガーで自動更新）';
COMMENT ON COLUMN projects.external_amount_achieved IS '外部サービス（Kickstarterなど）での達成金額';
COMMENT ON COLUMN projects.external_buyers_count IS '外部サービス（Kickstarterなど）での購入者数';
COMMENT ON COLUMN projects.external_achievement_rate IS '外部サービス（Kickstarterなど）での達成率';
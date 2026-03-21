/*
  # プロジェクト管理システムの初期スキーマ

  1. 新規テーブル
    - `projects`
      - `id` (uuid, プライマリーキー)
      - `title` (text, 必須) - プロジェクトのタイトル
      - `subtitle` (text, オプション) - サブタイトル
      - `amount_achieved` (integer, 必須) - 達成金額
      - `achievement_rate` (integer, デフォルト0) - 達成率
      - `buyers_count` (integer, デフォルト0) - 購入者数
      - `description` (text, オプション) - 詳細説明
      - `link_url` (text, 必須) - リンク先URL
      - `image_url` (text, 必須) - 画像URL
      - `created_at` (timestamptz, デフォルト現在時刻)
      - `updated_at` (timestamptz, デフォルト現在時刻)

  2. セキュリティ
    - プロジェクトテーブルのRLSを有効化
    - 認証済みユーザーのみがCRUD操作可能
*/

-- プロジェクトテーブルの作成
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  amount_achieved integer NOT NULL,
  achievement_rate integer DEFAULT 0,
  buyers_count integer DEFAULT 0,
  description text,
  link_url text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLSの有効化
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーのための読み取りポリシー
CREATE POLICY "認証済みユーザーは全プロジェクトを閲覧可能"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

-- 認証済みユーザーのための作成ポリシー
CREATE POLICY "認証済みユーザーは新規プロジェクトを作成可能"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 認証済みユーザーのための更新ポリシー
CREATE POLICY "認証済みユーザーは全プロジェクトを更新可能"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 認証済みユーザーのための削除ポリシー
CREATE POLICY "認証済みユーザーは全プロジェクトを削除可能"
  ON projects
  FOR DELETE
  TO authenticated
  USING (true);

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
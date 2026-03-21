/*
  # カテゴリーテーブルの作成とプロジェクトテーブルの更新

  1. 新規テーブル
    - `categories`
      - `id` (uuid, プライマリーキー)
      - `name` (text, 必須) - カテゴリー名
      - `created_at` (timestamptz) - 作成日時

  2. テーブル更新
    - `projects` テーブルに `category_id` カラムを追加
      - 外部キー制約で `categories` テーブルと紐付け

  3. セキュリティ
    - カテゴリーテーブルのRLSを有効化
    - 認証済みユーザーのみが管理可能
    - 誰でも閲覧可能
*/

DO $$ 
BEGIN
  -- カテゴリーテーブルが存在しない場合のみ作成
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'categories') THEN
    CREATE TABLE categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      created_at timestamptz DEFAULT now()
    );

    -- カテゴリーテーブルのRLS設定
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

    -- カテゴリーの管理ポリシー（認証済みユーザー）
    CREATE POLICY "Admin users can manage categories"
      ON categories
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM admin_users
        WHERE admin_users.id = auth.uid()
      ));

    -- カテゴリーの閲覧ポリシー（全ユーザー）
    CREATE POLICY "Categories are viewable by everyone"
      ON categories
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- プロジェクトテーブルにカテゴリーIDカラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN category_id uuid REFERENCES categories(id);
  END IF;
END $$;

-- 初期カテゴリーの登録
INSERT INTO categories (name) VALUES
  ('Fashion'),
  ('Design'),
  ('Crafts'),
  ('Tech'),
  ('Lifestyle'),
  ('Art'),
  ('Game')
ON CONFLICT (name) DO NOTHING;
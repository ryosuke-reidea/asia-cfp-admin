/*
  # プロジェクトテーブルのカラム追加

  1. 変更内容
    - `projects` テーブルに以下のカラムを追加:
      - `title` (text, 必須) - プロジェクトのタイトル
      - `subtitle` (text) - サブタイトル
      - `amount_achieved` (integer, 必須) - 達成金額
      - `achievement_rate` (integer, デフォルト0) - 達成率
      - `buyers_count` (integer, デフォルト0) - 購入者数
      - `description` (text) - 詳細説明
      - `link_url` (text, 必須) - リンク先URL
      - `image_url` (text, 必須) - 画像URL

  2. 既存データの保護
    - 新規カラムにデフォルト値を設定
    - NOT NULL制約を適切に設定
*/

DO $$ 
BEGIN
  -- カラムが存在しない場合のみ追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'title') THEN
    ALTER TABLE projects ADD COLUMN title text NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'subtitle') THEN
    ALTER TABLE projects ADD COLUMN subtitle text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'amount_achieved') THEN
    ALTER TABLE projects ADD COLUMN amount_achieved integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'achievement_rate') THEN
    ALTER TABLE projects ADD COLUMN achievement_rate integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'buyers_count') THEN
    ALTER TABLE projects ADD COLUMN buyers_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'description') THEN
    ALTER TABLE projects ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'link_url') THEN
    ALTER TABLE projects ADD COLUMN link_url text NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'image_url') THEN
    ALTER TABLE projects ADD COLUMN image_url text NOT NULL;
  END IF;
END $$;
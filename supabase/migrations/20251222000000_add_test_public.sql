/*
  # プロジェクトにテスト公開フラグを追加

  1. 変更内容
    - `projects`テーブルに`is_test_public`カラムを追加
      - `is_test_public` (boolean, デフォルトfalse) - テスト公開フラグ

  2. 説明
    - プロジェクトをテスト環境で公開するかどうかを管理するフラグを追加
    - デフォルトはfalseで、テスト公開されていない状態
*/

-- is_test_publicカラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'is_test_public'
  ) THEN
    ALTER TABLE projects ADD COLUMN is_test_public boolean DEFAULT false;
  END IF;
END $$;

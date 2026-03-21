/*
  # プロジェクトテーブルのスキーマ修正

  1. 変更内容
    - `name` カラムを削除し、代わりに `title` を使用
    - 既存のデータを保持

  2. セキュリティ
    - RLSポリシーは維持
*/

DO $$ 
BEGIN
  -- nameカラムが存在する場合のみ実行
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'name'
  ) THEN
    -- nameカラムを削除
    ALTER TABLE projects DROP COLUMN name;
  END IF;

  -- titleカラムが存在しない場合のみ実行
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'title'
  ) THEN
    -- titleカラムを追加（NOT NULL制約付き）
    ALTER TABLE projects ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
END $$;
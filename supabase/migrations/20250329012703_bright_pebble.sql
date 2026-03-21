/*
  # プロジェクトテーブルのカラム名修正

  1. 変更内容
    - `name` カラムを `title` に変更
    - 既存データを保持したまま移行

  2. セキュリティ
    - NOT NULL制約を維持
*/

DO $$ 
BEGIN
  -- nameカラムが存在し、titleカラムが存在しない場合のみ実行
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'title'
  ) THEN
    -- nameカラムの値をtitleカラムにコピー
    ALTER TABLE projects 
    ADD COLUMN title text;

    UPDATE projects 
    SET title = name;

    ALTER TABLE projects 
    ALTER COLUMN title SET NOT NULL;

    -- 古いnameカラムを削除
    ALTER TABLE projects 
    DROP COLUMN name;
  END IF;
END $$;
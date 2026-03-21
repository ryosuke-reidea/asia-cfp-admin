/*
  # プロジェクトに公開種別を追加

  1. テーブル変更
    - `projects` テーブルに `project_type` カラムを追加
    - デフォルト値は 'crowdfunding' (クラファン型)
    - 'media' (メディア型) または 'crowdfunding' (クラファン型) のみ許可

  2. セキュリティ
    - 既存のRLSポリシーはそのまま維持
    - 新しいカラムに対する制約を追加
*/

-- プロジェクトテーブルに公開種別カラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_type'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_type text DEFAULT 'crowdfunding' NOT NULL;
  END IF;
END $$;

-- 公開種別の制約を追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'projects_project_type_check'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_project_type_check 
    CHECK (project_type IN ('media', 'crowdfunding'));
  END IF;
END $$;

-- インデックスを追加（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
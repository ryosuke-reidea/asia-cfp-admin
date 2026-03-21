/*
  # RLSポリシーの修正

  1. Security Updates
    - project_comments テーブルのRLS有効化
    - 管理者による全操作を許可するポリシーを追加
    - 一般ユーザーによる挿入を許可するポリシーを追加

  2. Changes
    - project_comments テーブルでRLSを有効化
    - 管理者が全てのコメントを管理できるポリシーを追加
    - 一般ユーザーがコメントを投稿できるポリシーを追加
*/

-- project_comments テーブルのRLSを有効化
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Admin users can manage all comments" ON project_comments;
DROP POLICY IF EXISTS "Public can view approved comments" ON project_comments;
DROP POLICY IF EXISTS "Allow public to insert comments" ON project_comments;

-- 管理者が全てのコメントを管理できるポリシー
CREATE POLICY "Admin users can manage all comments"
  ON project_comments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- 承認済みコメントを一般公開で閲覧可能
CREATE POLICY "Public can view approved comments"
  ON project_comments
  FOR SELECT
  TO public
  USING (is_approved = true);

-- 一般ユーザーがコメントを投稿できるポリシー
CREATE POLICY "Allow public to insert comments"
  ON project_comments
  FOR INSERT
  TO public
  WITH CHECK (true);

-- rewards テーブルのポリシーも確認・修正
DROP POLICY IF EXISTS "Admin users can manage all rewards" ON rewards;
DROP POLICY IF EXISTS "Authenticated users can manage rewards" ON rewards;
DROP POLICY IF EXISTS "Public can view rewards of public projects" ON rewards;

-- 管理者が全てのリターンを管理できるポリシー
CREATE POLICY "Admin users can manage all rewards"
  ON rewards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- 認証済みユーザーがリターンを管理できるポリシー
CREATE POLICY "Authenticated users can manage rewards"
  ON rewards
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 公開プロジェクトのリターンを一般公開で閲覧可能
CREATE POLICY "Public can view rewards of public projects"
  ON rewards
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = rewards.project_id 
      AND projects.is_public = true
    )
  );
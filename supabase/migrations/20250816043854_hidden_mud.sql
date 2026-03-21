/*
  # リターン専用リンク機能のためのRLS調整

  1. Security Updates
    - `rewards`テーブルのRLSポリシーを更新
    - 公開プロジェクトのリターンを誰でも閲覧可能に設定
    - 認証済みユーザーがリターンを管理可能に設定
    - 管理者が全てのリターンを管理可能に設定

  2. Policy Changes
    - SELECT権限: 公開プロジェクトのリターンは誰でも閲覧可能
    - INSERT/UPDATE/DELETE権限: 認証済みユーザーと管理者が操作可能
    - link_urlカラムの読み取り権限を確保

  3. Index Optimization
    - link_urlカラムのインデックスを確認・最適化
*/

-- 既存のリターンポリシーを削除
DROP POLICY IF EXISTS "Admin users can manage all rewards" ON rewards;
DROP POLICY IF EXISTS "Authenticated users can manage rewards" ON rewards;
DROP POLICY IF EXISTS "Public can view rewards of public projects" ON rewards;

-- 新しいポリシーを作成
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

CREATE POLICY "Authenticated users can manage rewards"
  ON rewards
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users have full access to rewards"
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

-- link_urlカラムのインデックスが存在することを確認
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'rewards' 
    AND indexname = 'idx_rewards_link_url'
  ) THEN
    CREATE INDEX idx_rewards_link_url ON rewards (link_url);
  END IF;
END $$;
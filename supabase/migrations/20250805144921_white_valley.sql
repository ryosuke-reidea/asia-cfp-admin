/*
  # コメント削除のためのRLS調整

  1. Security Changes
    - 認証済みユーザーがコメントを削除できるようにRLSポリシーを追加
    - 管理者権限でのコメント削除を許可

  2. Policy Updates
    - DELETE操作用のポリシーを追加
    - 認証済みユーザーの削除権限を設定
*/

-- 認証済みユーザーがコメントを削除できるポリシーを追加
CREATE POLICY "Authenticated users can delete comments"
  ON project_comments
  FOR DELETE
  TO authenticated
  USING (true);

-- 管理者ユーザーがコメントを削除できるポリシーを追加（より具体的な権限）
CREATE POLICY "Admin users can delete all comments"
  ON project_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );
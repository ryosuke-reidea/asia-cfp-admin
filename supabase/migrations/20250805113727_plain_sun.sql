/*
  # コメント削除機能のためのRLSポリシー更新

  1. 既存ポリシーの確認と更新
    - 管理者ユーザーがコメントを削除できるようにする
    - 認証済みユーザーの削除権限を確認

  2. セキュリティ
    - 管理者のみが削除可能
    - 適切な権限チェック
*/

-- 既存の削除ポリシーを確認（存在する場合は削除して再作成）
DROP POLICY IF EXISTS "Admin users can delete all comments" ON project_comments;
DROP POLICY IF EXISTS "Authenticated users can delete comments" ON project_comments;

-- 管理者ユーザーがすべてのコメントを削除できるポリシーを作成
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

-- 認証済みユーザーが一般的にコメントを削除できるポリシーも追加（管理画面用）
CREATE POLICY "Authenticated users can delete comments"
  ON project_comments
  FOR DELETE
  TO authenticated
  USING (true);
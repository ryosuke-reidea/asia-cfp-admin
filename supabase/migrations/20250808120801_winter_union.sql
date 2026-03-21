/*
  # コメント編集のためのRLS調整

  1. 変更内容
    - 認証済みユーザーがコメントを更新できるようにUPDATEポリシーを追加
    - 管理者ユーザーが全てのコメントを更新できる権限を追加
    - 既存のポリシーとの整合性を保持

  2. セキュリティ
    - 認証済みユーザーのみがコメントを編集可能
    - 管理者は全てのコメントを編集可能
    - 適切な権限チェックを実装
*/

-- 認証済みユーザーがコメントを更新できるポリシーを追加
CREATE POLICY "Authenticated users can update comments"
  ON project_comments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 管理者ユーザーが全てのコメントを更新できるポリシーを追加
CREATE POLICY "Admin users can update all comments"
  ON project_comments
  FOR UPDATE
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
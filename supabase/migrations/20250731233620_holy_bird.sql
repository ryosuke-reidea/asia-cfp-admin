/*
  # プロジェクト更新ポリシーの修正

  1. 既存のポリシー削除
    - 重複している更新ポリシーを削除
    - 不適切な制限があるポリシーを削除

  2. 新しいポリシー作成
    - 認証済みユーザーがプロジェクトを更新できるポリシー
    - 詳細説明と製作者説明の更新を含む全フィールドの更新を許可

  3. セキュリティ
    - 認証済みユーザーのみがプロジェクトを更新可能
    - 適切なRLS設定を維持
*/

-- 既存の重複するポリシーを削除
DROP POLICY IF EXISTS "認証済みユーザーは全プロジェクトを更新可能" ON projects;
DROP POLICY IF EXISTS "Only admins can modify projects" ON projects;

-- 新しい更新ポリシーを作成
CREATE POLICY "Authenticated users can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 既存の挿入ポリシーも確認・修正
DROP POLICY IF EXISTS "認証済みユーザーは新規プロジェクトを作成可" ON projects;

CREATE POLICY "Authenticated users can insert projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
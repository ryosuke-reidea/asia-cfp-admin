/*
  # プロジェクト画像用のストレージバケットの作成

  1. 新規バケット
    - `project-images` バケット
      - パブリックアクセス可能
      - 認証済みユーザーのみアップロード可能

  2. セキュリティ
    - 認証済みユーザーのみがアップロード可能
    - 誰でも画像を閲覧可能
*/

-- プロジェクト画像用のバケットを作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- 認証済みユーザーのみがアップロード可能なポリシーを作成
CREATE POLICY "認証済みユーザーは画像をアップロード可能" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-images');

-- 誰でも画像を閲覧可能なポリシーを作成
CREATE POLICY "誰でも画像を閲覧可能" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'project-images');
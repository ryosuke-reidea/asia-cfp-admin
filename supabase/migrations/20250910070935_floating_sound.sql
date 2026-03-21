/*
  # Category Sort Order Auto-Update System

  1. Database Functions
    - `increment_category_sort_orders()` - 同カテゴリーの既存プロジェクトのsort_orderを+1する
    - `update_category_sort_order()` - 新規プロジェクト作成時に自動的にsort_orderを設定

  2. Triggers
    - プロジェクト作成時に自動実行されるトリガーを更新

  3. Changes
    - 新しいプロジェクトは常にcategory_sort_order = 0で最上位に配置
    - 同カテゴリーの既存プロジェクトは自動的に+1される
    - カテゴリー変更時も適切に処理される
*/

-- 同カテゴリーの既存プロジェクトのsort_orderを+1する関数
CREATE OR REPLACE FUNCTION increment_category_sort_orders(target_category_id uuid)
RETURNS void AS $$
BEGIN
  -- 指定されたカテゴリーの全プロジェクトのsort_orderを+1する
  UPDATE projects 
  SET category_sort_order = category_sort_order + 1
  WHERE category_id = target_category_id;
END;
$$ LANGUAGE plpgsql;

-- プロジェクト作成・更新時のsort_order自動設定関数を更新
CREATE OR REPLACE FUNCTION update_category_sort_order()
RETURNS trigger AS $$
BEGIN
  -- 新規作成の場合
  IF TG_OP = 'INSERT' THEN
    -- category_idが設定されている場合のみ処理
    IF NEW.category_id IS NOT NULL THEN
      -- 同カテゴリーの既存プロジェクトのsort_orderを+1
      PERFORM increment_category_sort_orders(NEW.category_id);
      
      -- 新しいプロジェクトのsort_orderを0に設定（最上位）
      NEW.category_sort_order = 0;
    ELSE
      -- カテゴリーが未設定の場合は0のまま
      NEW.category_sort_order = 0;
    END IF;
    
    RETURN NEW;
  END IF;

  -- 更新の場合
  IF TG_OP = 'UPDATE' THEN
    -- カテゴリーが変更された場合
    IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
      -- 新しいカテゴリーが設定されている場合
      IF NEW.category_id IS NOT NULL THEN
        -- 新しいカテゴリーの既存プロジェクトのsort_orderを+1
        PERFORM increment_category_sort_orders(NEW.category_id);
        
        -- このプロジェクトを新しいカテゴリーの最上位（0）に設定
        NEW.category_sort_order = 0;
      ELSE
        -- カテゴリーが削除された場合は0に設定
        NEW.category_sort_order = 0;
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーを削除して再作成
DROP TRIGGER IF EXISTS auto_update_category_sort_order ON projects;

CREATE TRIGGER auto_update_category_sort_order
  BEFORE INSERT OR UPDATE OF category_id ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_category_sort_order();

-- 手動でsort_orderを調整する関数（管理用）
CREATE OR REPLACE FUNCTION reorder_category_projects(target_category_id uuid)
RETURNS void AS $$
DECLARE
  project_record RECORD;
  current_order integer := 0;
BEGIN
  -- 指定されたカテゴリーのプロジェクトを作成日順（新しい順）で並び替え
  FOR project_record IN
    SELECT id FROM projects 
    WHERE category_id = target_category_id 
    ORDER BY created_at DESC
  LOOP
    UPDATE projects 
    SET category_sort_order = current_order 
    WHERE id = project_record.id;
    
    current_order := current_order + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 全カテゴリーのsort_orderを再計算する関数（メンテナンス用）
CREATE OR REPLACE FUNCTION reorder_all_categories()
RETURNS void AS $$
DECLARE
  category_record RECORD;
BEGIN
  -- 全カテゴリーに対して並び替えを実行
  FOR category_record IN
    SELECT DISTINCT category_id FROM projects WHERE category_id IS NOT NULL
  LOOP
    PERFORM reorder_category_projects(category_record.category_id);
  END LOOP;
  
  -- カテゴリー未設定のプロジェクトも並び替え
  UPDATE projects 
  SET category_sort_order = (
    SELECT ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1
    FROM projects p2 
    WHERE p2.category_id IS NULL AND p2.id = projects.id
  )
  WHERE category_id IS NULL;
END;
$$ LANGUAGE plpgsql;
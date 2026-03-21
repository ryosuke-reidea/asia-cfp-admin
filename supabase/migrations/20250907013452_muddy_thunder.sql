/*
  # Disable RLS for projects table

  1. Changes
    - Disable Row Level Security on projects table
    - Remove all existing policies on projects table

  2. Security
    - This removes all access restrictions on the projects table
    - All authenticated and anonymous users will have full access
*/

-- Disable RLS on projects table
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on projects table
DROP POLICY IF EXISTS "Admin users have full access to projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON projects;
DROP POLICY IF EXISTS "Public can view published projects" ON projects;
DROP POLICY IF EXISTS "System can update project stats" ON projects;
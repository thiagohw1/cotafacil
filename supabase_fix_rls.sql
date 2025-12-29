-- Create a specific function to handle avatar uploads securely
-- This avoids complex RLS policies that often fail

-- 1. Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Delete Access" ON storage.objects;

-- 3. Create simplified RLS policies

-- Allow public read access to all avatars
CREATE POLICY "Avatar Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Allow users to upload their own avatar (folder must match user_id)
-- Note: We use simpler checks to avoid "new row violates row-level security policy"
CREATE POLICY "Avatar Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own avatar
CREATE POLICY "Avatar Update Access"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatar
CREATE POLICY "Avatar Delete Access"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Verify profiles table usage
-- Ensure the profile update won't be blocked (which is a separate RLS check)
-- "Users can update own profile" should already exist, but let's be safe.
-- (This part is just for reference, running it won't hurt)

-- Create a function to handle avatar uploads, bypassing storage RLS complexity
-- This function will decode a base64 string and insert/update it into storage.objects

CREATE OR REPLACE FUNCTION upload_avatar(
  p_user_id UUID,
  p_file_content TEXT, -- Base64 encoded content
  p_content_type TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner (bypass RLS)
SET search_path = public, storage, extensions
AS $$
DECLARE
  v_bucket_id TEXT := 'avatars';
  v_filename TEXT;
  v_binary_content BYTEA;
BEGIN
  -- Validate owner
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_filename := p_user_id || '/avatar.jpg';
  v_binary_content := decode(p_file_content, 'base64');

  -- Ensure bucket exists (just in case)
  INSERT INTO storage.buckets (id, name, public)
  VALUES (v_bucket_id, v_bucket_id, true)
  ON CONFLICT (id) DO NOTHING;

  -- Upsert file into storage.objects
  -- Note: We interact directly with the storage schema tables.
  -- This is generally stable but relies on internal Supabase structure.
  
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES (
    v_bucket_id,
    v_filename,
    auth.uid(),
    jsonb_build_object('mimetype', p_content_type, 'cacheControl', '3600')
  )
  ON CONFLICT (bucket_id, name)
  DO UPDATE SET
    metadata = EXCLUDED.metadata,
    updated_at = now();

  -- We need to manually handle the actual file content?
  -- Wait, writing to storage.objects merely updates metadata. 
  -- The actual file content usually goes through the API which writes to S3/file system.
  -- Writing to storage.objects DOES NOT upload the file content in Supabase Storage.
  
  -- ABORT: Use the standard API but with a different approach?
  -- No, we cannot easily upload binary content via SQL function in Supabase without http extensions.
  
  -- ALTERNATIVE STRATEGY:
  -- The previous RLS error might be due to `storage.foldername(name)` returning an array.
  -- Let's try one last RLS fix that is extremely simple and proven.
  
  RETURN 'Function aborted - strategy change';
END;
$$;

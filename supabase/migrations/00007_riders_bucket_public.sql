-- Make riders bucket public so profile photos render via Next.js <Image>
UPDATE storage.buckets SET public = true WHERE id = 'riders';

-- Add explicit public read policy (consistent with products/branding buckets)
CREATE POLICY "riders storage: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'riders');

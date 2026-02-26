-- ============================================================
-- Storage Buckets & Policies
-- ============================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('products',      'products',      true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('branding',      'branding',      true,  2097152,  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('prescriptions', 'prescriptions', false, 10485760, ARRAY['image/jpeg','image/png','application/pdf']),
  ('senior-pwd-ids','senior-pwd-ids',false, 10485760, ARRAY['image/jpeg','image/png','application/pdf']),
  ('pod',           'pod',           false, 10485760, ARRAY['image/jpeg','image/png']),
  ('riders',        'riders',        false, 5242880,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ──────────────────────────────────────────────

-- products bucket: public read, admin write
CREATE POLICY "products storage: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "products storage: admin write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "products storage: admin update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'products' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "products storage: admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'products' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- branding bucket: public read, admin write
CREATE POLICY "branding storage: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'branding');

CREATE POLICY "branding storage: admin write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'branding' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "branding storage: admin update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'branding' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- prescriptions bucket: customer write own, admin read
CREATE POLICY "prescriptions: customer write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'prescriptions' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "prescriptions: admin read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'prescriptions' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','rider'))
  );

-- senior-pwd-ids bucket: customer write own, admin read
CREATE POLICY "senior-pwd-ids: customer write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'senior-pwd-ids' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "senior-pwd-ids: admin read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'senior-pwd-ids' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- pod bucket: rider write, admin read
CREATE POLICY "pod: rider write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pod' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'rider')
  );

CREATE POLICY "pod: admin read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pod' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','rider'))
  );

-- riders bucket: admin write, rider read own
CREATE POLICY "riders storage: admin write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'riders' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "riders storage: rider read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'riders' AND auth.uid() IS NOT NULL
  );

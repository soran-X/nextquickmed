-- Admin needs UPDATE + DELETE on riders storage for upsert to work
CREATE POLICY "riders storage: admin update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'riders' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "riders storage: admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'riders' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- Fix: Remove malformed admin auth user and recreate cleanly
-- The SQL-direct insertion left auth.identities in a state
-- GoTrue cannot parse during sign-in schema validation.
-- We wipe and let the app re-create via Admin API instead.
-- ============================================================

DO $$
DECLARE
  v_email TEXT := 'jamesalain14@gmail.com';
  v_uid   UUID;
BEGIN
  -- Get current user id (may be the one we inserted, or null)
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'No user found for %, nothing to clean.', v_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Cleaning up user % (%)', v_email, v_uid;

  -- 1. Delete all sessions for this user
  DELETE FROM auth.sessions       WHERE user_id = v_uid;

  -- 2. Delete refresh tokens (user_id is varchar in some GoTrue versions)
  DELETE FROM auth.refresh_tokens WHERE user_id::text = v_uid::text;

  -- 3. Delete MFA factors
  DELETE FROM auth.mfa_factors    WHERE user_id = v_uid;

  -- 4. Delete identities (the corrupt records)
  DELETE FROM auth.identities     WHERE user_id = v_uid;

  -- 5. Delete the profile row
  DELETE FROM profiles            WHERE id = v_uid;

  -- 6. Finally delete the auth user itself
  DELETE FROM auth.users          WHERE id = v_uid;

  RAISE NOTICE 'User % fully removed. Re-create via Admin API.', v_email;
END $$;

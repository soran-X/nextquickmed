-- ============================================================
-- Seed: Default Admin User
-- NOTE: Direct SQL insertion into auth.users is unreliable.
-- The actual admin was created via GoTrue Admin API.
-- This migration is kept for history only – it is a no-op
-- if the user already exists (handled by migration 00006).
-- Credentials: jamesalain14@gmail.com / QuickMed@2024
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_email   TEXT := 'jamesalain14@gmail.com';
  v_existing_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_existing_id
  FROM auth.users
  WHERE email = v_email;

  IF v_existing_id IS NOT NULL THEN
    -- User exists – just ensure admin role
    UPDATE profiles SET role = 'admin' WHERE id = v_existing_id;
    RAISE NOTICE 'User % already exists (%), promoted to admin.', v_email, v_existing_id;
    RETURN;
  END IF;

  -- ── 1. Create the auth user ───────────────────────────────
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    -- Password: QuickMed@2024
    extensions.crypt('QuickMed@2024', extensions.gen_salt('bf')),
    NOW(),          -- email pre-confirmed
    NOW(),
    NULL,
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', 'James Alain'),
    NOW(),
    NOW(),
    FALSE,
    FALSE
  );

  -- ── 2. Create the identity record (required for email login) ─
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,           -- identity id = user id for email provider
    v_user_id,
    v_email,             -- provider_id = email for email provider
    jsonb_build_object(
      'sub',   v_user_id::TEXT,
      'email', v_email,
      'email_verified', TRUE,
      'provider', 'email'
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- ── 3. Upsert the profile as admin ────────────────────────
  -- The handle_new_user trigger should fire on auth.users insert,
  -- but we upsert here too as a safety net.
  INSERT INTO profiles (id, role, full_name)
  VALUES (v_user_id, 'admin', 'James Alain')
  ON CONFLICT (id) DO UPDATE
    SET role      = 'admin',
        full_name = COALESCE(profiles.full_name, 'James Alain'),
        updated_at = NOW();

  RAISE NOTICE 'Admin user created: % (%)', v_email, v_user_id;
END $$;

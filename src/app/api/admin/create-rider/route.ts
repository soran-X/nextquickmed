import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient();

  // Verify requester is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, password, full_name, phone } = await request.json();

  // Create auth user with service role
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 400 });
  }

  const userId = newUser.user.id;

  // Update profile: set role to rider + personal info
  await supabase.from('profiles').update({
    role: 'rider',
    full_name,
    phone,
  }).eq('id', userId);

  return NextResponse.json({ userId });
}

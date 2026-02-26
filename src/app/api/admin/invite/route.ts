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

  const { email, role = 'admin' } = await request.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  if (!['admin', 'rider'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Send magic-link invitation via Supabase
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/accept-invite?role=${role}`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Pre-set the role on the profile row (will exist after user accepts invite)
  // We store it in a pending_invites concept via user metadata
  await supabase.auth.admin.updateUserById(data.user.id, {
    user_metadata: { invited_role: role },
  });

  return NextResponse.json({ success: true, email: data.user.email });
}

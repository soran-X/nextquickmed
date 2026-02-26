import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyProofOfDelivery } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  // Verify auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'rider' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { imageBase64, mimeType, expectedInvoiceNo } = await request.json();

    if (!imageBase64 || !mimeType || !expectedInvoiceNo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await verifyProofOfDelivery(imageBase64, mimeType, expectedInvoiceNo);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Gemini verification error:', err);
    // Return a safe fallback – don't crash the rider app
    return NextResponse.json({
      match: false,
      reason: 'Verification service temporarily unavailable. Please notify admin.',
    });
  }
}

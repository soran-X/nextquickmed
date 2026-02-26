'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { toast } from 'sonner';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';

/**
 * Accept-invite page: the user lands here after clicking the magic-link email.
 * Supabase automatically handles the token in the URL hash; we just need to
 * let them set a password and then assign the queued role.
 */
function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') ?? 'admin';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Supabase SSR handles the token from URL hash on mount
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);

    // Update password (user is already logged in via the magic link)
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) {
      toast.error(pwErr.message);
      setLoading(false);
      return;
    }

    // Apply the invited role to the profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const invitedRole = user.user_metadata?.invited_role ?? role;
      await supabase
        .from('profiles')
        .update({ role: invitedRole })
        .eq('id', user.id);
    }

    setDone(true);
    toast.success('Account setup complete!');
    setLoading(false);

    // Redirect to appropriate panel
    setTimeout(() => {
      if (role === 'admin') router.push('/admin/dashboard');
      else if (role === 'rider') router.push('/rider/dashboard');
      else router.push('/');
    }, 1500);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <CheckCircle2 className="h-14 w-14 mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
          <h1 className="text-xl font-bold text-gray-900">Account ready!</h1>
          <p className="text-gray-500 mt-1">Redirecting you now…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo height={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set your password</h1>
          <p className="text-gray-500 text-sm mt-1">
            You&apos;ve been invited as a{' '}
            <span className="font-semibold capitalize" style={{ color: 'var(--brand-primary)' }}>
              {role}
            </span>
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up…' : 'Activate Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}

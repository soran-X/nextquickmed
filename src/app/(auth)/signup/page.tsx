'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { getGuestCart, clearGuestCart } from '@/lib/cart';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/products';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      // Update profile with phone
      await supabase.from('profiles').update({ phone, full_name: fullName }).eq('id', userId);

      // Transfer guest cart to DB cart
      const guestItems = getGuestCart();
      if (guestItems.length > 0) {
        const { data: cart } = await supabase
          .from('carts')
          .insert({ user_id: userId })
          .select('id')
          .single();

        if (cart) {
          const cartItems = guestItems.map((item) => ({
            cart_id: cart.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));
          await supabase.from('cart_items').insert(cartItems);
          clearGuestCart();
          toast.success('Your cart has been saved to your account');
        }
      }
    }

    toast.success('Account created! Welcome to QuickMed.');
    router.push(redirectTo);
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo height={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Fast medicine delivery starts here</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Juan dela Cruz" value={fullName}
                onChange={(e) => setFullName(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="+63 912 345 6789" value={phone}
                onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input id="password" type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
            className="font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

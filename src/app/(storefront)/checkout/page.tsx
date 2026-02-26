'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocationPicker } from '@/components/storefront/LocationPicker';
import { formatCurrency } from '@/lib/utils';
import { computeDeliveryFee, computeVAT, applySeniorPWDDiscount } from '@/lib/haversine';
import { Settings, Profile } from '@/types';
import { toast } from 'sonner';
import { Upload, MapPin, ShoppingBag, CheckCircle, AlertCircle } from 'lucide-react';

type Step = 'auth' | 'location' | 'discounts' | 'review' | 'success';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [step, setStep] = useState<Step>('auth');
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  // Location
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [address, setAddress] = useState('');

  // Discounts
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [seniorPwdFile, setSeniorPwdFile] = useState<File | null>(null);
  const [discountType, setDiscountType] = useState<'senior' | 'pwd' | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Computed
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (items.length === 0) router.push('/cart');
  }, [items, router]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email ?? '' });
        setStep('location');
        // Load profile
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
          if (data) {
            setProfile(data);
            if (data.delivery_lat && data.delivery_lng) {
              setLat(data.delivery_lat);
              setLng(data.delivery_lng);
              setAddress(data.address ?? '');
            }
          }
        });
      }
    });

    // Load settings for base location + fee
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setSettings(data);
    });
  }, []);

  // Recompute delivery fee when location changes
  useEffect(() => {
    if (settings?.base_lat && settings?.base_lng && lat && lng) {
      const { distanceKm: d, deliveryFee: f } = computeDeliveryFee(
        lat, lng,
        settings.base_lat, settings.base_lng,
        settings.delivery_fee_per_km
      );
      setDistanceKm(d);
      setDeliveryFee(f);
    }
  }, [lat, lng, settings]);

  const handleLocationConfirm = () => {
    if (!lat || !lng) {
      toast.error('Please drop a pin on your delivery location');
      return;
    }
    setStep('discounts');
  };

  const handleDiscountApply = (type: 'senior' | 'pwd') => {
    if (discountType === type) {
      setDiscountType(null);
      setDiscountAmount(0);
    } else {
      setDiscountType(type);
      setDiscountAmount(applySeniorPWDDiscount(subtotal));
    }
  };

  const { vatAmount } = computeVAT(subtotal);
  const codTotal = Math.max(0, subtotal + vatAmount + deliveryFee - discountAmount);

  const handlePlaceOrder = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Upload files if provided
      let prescriptionUrl: string | null = null;
      let seniorPwdUrl: string | null = null;

      if (prescriptionFile) {
        const ext = prescriptionFile.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('prescriptions')
          .upload(path, prescriptionFile);
        if (!upErr) {
          const { data } = supabase.storage.from('prescriptions').getPublicUrl(path);
          prescriptionUrl = data.publicUrl;
        }
      }

      if (seniorPwdFile) {
        const ext = seniorPwdFile.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('senior-pwd-ids')
          .upload(path, seniorPwdFile);
        if (!upErr) {
          const { data } = supabase.storage.from('senior-pwd-ids').getPublicUrl(path);
          seniorPwdUrl = data.publicUrl;
        }
      }

      // Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          delivery_address: address,
          delivery_lat: lat,
          delivery_lng: lng,
          distance_km: distanceKm,
          subtotal,
          vat_amount: vatAmount,
          delivery_fee: deliveryFee,
          discount_amount: discountAmount,
          discount_type: discountType,
          cod_total: codTotal,
          prescription_url: prescriptionUrl,
          senior_pwd_id_url: seniorPwdUrl,
          status: 'pending',
        })
        .select('id')
        .single();

      if (orderErr || !order) throw orderErr ?? new Error('Failed to create order');

      // Insert order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Update profile delivery location
      await supabase.from('profiles').update({
        delivery_lat: lat,
        delivery_lng: lng,
        address,
      }).eq('id', user.id);

      // Decrement stock
      for (const item of items) {
        await supabase.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        }).maybeSingle();
      }

      clear();
      setOrderId(order.id);
      setStep('success');
    } catch (err) {
      console.error(err);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-gray-500 mb-2">
          Your order has been received and is being processed.
        </p>
        <p className="text-sm text-gray-400 mb-8">Order ID: <code className="font-mono">{orderId}</code></p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link href="/orders">View Orders</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Step: Auth required
  if (step === 'auth') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in to Checkout</h1>
        <p className="text-gray-500 mb-8">
          Create an account or sign in to complete your order.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link href={`/signup?redirect=/checkout`}>Create Account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/login?redirect=/checkout`}>Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {(['location', 'discounts', 'review'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step === s
                ? 'text-white'
                : i < ['location','discounts','review'].indexOf(step)
                  ? 'text-white opacity-70'
                  : 'bg-gray-200 text-gray-500'
            }`} style={
              step === s || i < ['location','discounts','review'].indexOf(step)
                ? { backgroundColor: 'var(--brand-primary)' }
                : {}
            }>
              {i + 1}
            </div>
            <span className="text-sm font-medium text-gray-600 hidden sm:inline capitalize">{s}</span>
            {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {step === 'location' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <MapPin className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
                Delivery Location
              </h2>
              <p className="text-sm text-gray-500 mb-4">Drop a pin on your delivery address.</p>
              <LocationPicker
                lat={lat}
                lng={lng}
                onChange={(newLat, newLng, addr) => {
                  setLat(newLat);
                  setLng(newLng);
                  if (addr) setAddress(addr);
                }}
                defaultCenter={
                  settings?.base_lat && settings?.base_lng
                    ? [settings.base_lat, settings.base_lng]
                    : undefined
                }
              />
              <div className="mt-4">
                <Label htmlFor="addr-note">Address Notes (unit, floor, landmark)</Label>
                <Input
                  id="addr-note"
                  className="mt-1"
                  placeholder="e.g. Unit 3B, Blue Gate"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <Button className="mt-4 w-full" onClick={handleLocationConfirm}>
                Confirm Location
              </Button>
            </div>
          )}

          {step === 'discounts' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Discounts & Documents</h2>

              {/* Prescription upload */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Upload className="h-4 w-4" /> Prescription (if required)
                </Label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setPrescriptionFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {prescriptionFile && (
                  <p className="text-xs text-green-600 mt-1">✓ {prescriptionFile.name}</p>
                )}
              </div>

              {/* Senior/PWD discount */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Senior Citizen / PWD Discount (20% off subtotal)
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleDiscountApply('senior')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      discountType === 'senior'
                        ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-blue-50'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Senior Citizen
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscountApply('pwd')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      discountType === 'pwd'
                        ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-blue-50'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    PWD
                  </button>
                </div>
                {discountType && (
                  <div className="mt-3">
                    <Label className="flex items-center gap-2 mb-2">
                      <Upload className="h-4 w-4" /> Upload {discountType === 'senior' ? 'Senior Citizen' : 'PWD'} ID
                    </Label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setSeniorPwdFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {seniorPwdFile && (
                      <p className="text-xs text-green-600 mt-1">✓ {seniorPwdFile.name}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('location')} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep('review')} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Review Your Order</h2>

              {/* Items */}
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.product_id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.product.brand_name}</p>
                      <p className="text-xs text-gray-400">× {item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(item.quantity * item.product.price)}</span>
                  </div>
                ))}
              </div>

              {/* Delivery info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 flex items-start gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-primary)' }} />
                <div>
                  <p className="font-medium">Delivery to:</p>
                  <p className="text-gray-500">{address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</p>
                  <p className="text-xs text-gray-400 mt-1">{distanceKm.toFixed(2)} km from pharmacy</p>
                </div>
              </div>

              <p className="text-sm text-gray-500 font-medium">
                Payment: <span className="text-gray-900">Cash on Delivery (COD)</span>
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('discounts')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handlePlaceOrder} disabled={loading} className="flex-1">
                  {loading ? 'Placing Order…' : `Place Order – ${formatCurrency(codTotal)}`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Order Summary
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT (12%)</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span>{deliveryFee > 0 ? formatCurrency(deliveryFee) : '—'}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>{discountType === 'senior' ? 'Senior' : 'PWD'} Discount</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-gray-900">
            <span>COD Total</span>
            <span>{formatCurrency(codTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

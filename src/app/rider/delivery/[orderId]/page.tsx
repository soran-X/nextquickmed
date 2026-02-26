'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatInvoiceNo } from '@/lib/utils';
import { toast } from 'sonner';
import {
  MapPin, Package, Phone, Camera, CheckCircle2, AlertTriangle,
  Navigation, ArrowLeft, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const MapComponent = dynamic(() => import('@/components/storefront/MapComponent'), { ssr: false });

type DeliveryStep = 'overview' | 'delivering' | 'pod_capture' | 'verifying' | 'done';

export default function RiderDeliveryPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<{ base_lat: number; base_lng: number } | null>(null);
  const [step, setStep] = useState<DeliveryStep>('overview');
  const [podFile, setPodFile] = useState<File | null>(null);
  const [podPreview, setPodPreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [aiResult, setAiResult] = useState<{ match: boolean; reason: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    Promise.all([
      supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!customer_id(full_name, phone),
          order_items(*, product:products(brand_name, generic_name))
        `)
        .eq('id', orderId)
        .single(),
      supabase.from('settings').select('base_lat, base_lng').eq('id', 1).single(),
    ]).then(([orderRes, settingsRes]) => {
      if (orderRes.data) setOrder(orderRes.data as unknown as Order);
      if (settingsRes.data) setSettings(settingsRes.data);
    });
  }, [orderId]);

  const handleStartDelivery = async () => {
    await supabase.from('orders').update({ status: 'out_for_delivery' }).eq('id', orderId);
    setStep('delivering');
    toast.success('Delivery started!');
  };

  const handlePodFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPodFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPodPreview(reader.result as string);
    reader.readAsDataURL(file);
    setStep('pod_capture');
  };

  const handleConfirmDelivery = async () => {
    if (!podFile || !order) return;
    setVerifying(true);
    setStep('verifying');

    try {
      // 1. Upload POD image
      const ext = podFile.name.split('.').pop() ?? 'jpg';
      const podPath = `${order.rider_id}/${order.id}/pod.${ext}`;
      await supabase.storage.from('pod').upload(podPath, podFile, { upsert: true });
      const { data: podUrlData } = supabase.storage.from('pod').getPublicUrl(podPath);
      const podUrl = podUrlData.publicUrl;

      // 2. Convert file to base64 for Gemini
      const base64 = await fileToBase64(podFile);
      const expectedInvoiceNo = formatInvoiceNo(order.invoice_prefix, order.invoice_no);

      // 3. Call Gemini verification via API route
      const verifyRes = await fetch('/api/pod/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64.split(',')[1], // strip data: prefix
          mimeType: podFile.type,
          expectedInvoiceNo,
          orderId: order.id,
          podUrl,
        }),
      });

      const result = await verifyRes.json();
      setAiResult(result);

      if (result.match) {
        // Mark as delivered
        await supabase.from('orders').update({
          status: 'delivered',
          pod_image_url: podUrl,
          pod_ai_result: result,
        }).eq('id', order.id);
        toast.success('Delivery confirmed!');
      } else {
        // Flag for manual review
        await supabase.from('orders').update({
          status: 'needs_manual_review',
          pod_image_url: podUrl,
          pod_ai_result: result,
        }).eq('id', order.id);
        toast.error('POD verification failed – flagged for admin review');
      }

      setStep('done');
    } catch (err) {
      console.error(err);
      toast.error('Verification failed. Please try again.');
      setStep('pod_capture');
    } finally {
      setVerifying(false);
    }
  };

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const customer = order.customer as unknown as { full_name?: string; phone?: string } | null;
  const items = (order.order_items ?? []) as Array<{
    id: string; quantity: number; unit_price: number; subtotal: number;
    product?: { brand_name: string; generic_name: string };
  }>;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Link href="/rider/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--brand-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to Queue
      </Link>

      {/* Invoice banner */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Sales Invoice</p>
        <p className="text-3xl font-black font-mono tracking-wider"
          style={{ color: 'var(--brand-primary)' }}>
          {formatInvoiceNo(order.invoice_prefix, order.invoice_no)}
        </p>
        <p className="text-sm text-gray-500 mt-1">{formatCurrency(order.cod_total)} – COD</p>
      </div>

      {/* Customer info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
          Delivery Details
        </h3>
        <p className="font-medium text-gray-800">{customer?.full_name ?? 'Customer'}</p>
        {customer?.phone && (
          <a href={`tel:${customer.phone}`}
            className="text-sm text-blue-600 flex items-center gap-1 mt-0.5 hover:underline">
            <Phone className="h-3.5 w-3.5" /> {customer.phone}
          </a>
        )}
        <p className="text-sm text-gray-500 mt-1">{order.delivery_address}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {order.distance_km ? `~${order.distance_km.toFixed(1)} km from pharmacy` : ''}
        </p>
      </div>

      {/* Map */}
      {order.delivery_lat && order.delivery_lng && (
        <div className="rounded-xl overflow-hidden">
          <MapComponent
            lat={order.delivery_lat}
            lng={order.delivery_lng}
            onMapClick={() => {}}
            defaultCenter={[order.delivery_lat, order.delivery_lng]}
            readOnly
            markers={[
              { lat: order.delivery_lat, lng: order.delivery_lng },
              ...(settings?.base_lat && settings?.base_lng
                ? [{ lat: settings.base_lat, lng: settings.base_lng }]
                : []),
            ]}
          />
        </div>
      )}

      {/* Order items */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
          Items ({items.length})
        </h3>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="py-2 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.product?.brand_name ?? '—'}</p>
                <p className="text-xs text-gray-400">{item.product?.generic_name ?? ''}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">×{item.quantity}</p>
                <p className="text-sm font-semibold">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 mt-2 flex justify-between font-bold">
          <span>COD Amount</span>
          <span style={{ color: 'var(--brand-primary)' }}>{formatCurrency(order.cod_total)}</span>
        </div>
      </div>

      {/* Action area */}
      {step === 'overview' && order.status !== 'delivered' && order.status !== 'needs_manual_review' && (
        <Button className="w-full gap-2 h-12 text-base" onClick={handleStartDelivery}>
          <Navigation className="h-5 w-5" /> Start Delivery
        </Button>
      )}

      {step === 'delivering' && (
        <div className="space-y-3">
          <p className="text-center text-sm text-green-600 font-medium">
            ✓ Delivery in progress – collect COD and take a photo
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePodFileChange}
            className="hidden"
          />
          <Button
            className="w-full gap-2 h-12 text-base"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-5 w-5" /> Capture Proof of Delivery
          </Button>
        </div>
      )}

      {step === 'pod_capture' && podPreview && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={podPreview} alt="Proof of Delivery" className="w-full object-cover max-h-72" />
          </div>
          <p className="text-xs text-gray-500 text-center">
            Make sure the <strong>invoice number and recipient</strong> are clearly visible
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1"
              onClick={() => { setPodFile(null); setPodPreview(null); setStep('delivering'); }}>
              Retake
            </Button>
            <Button className="flex-1 gap-2" onClick={handleConfirmDelivery}>
              <CheckCircle2 className="h-4 w-4" /> Confirm Delivery
            </Button>
          </div>
        </div>
      )}

      {step === 'verifying' && (
        <div className="text-center py-8">
          <Loader2 className="h-10 w-10 mx-auto animate-spin mb-3" style={{ color: 'var(--brand-primary)' }} />
          <p className="font-semibold text-gray-700">Verifying with AI…</p>
          <p className="text-sm text-gray-400 mt-1">Checking invoice number and recipient</p>
        </div>
      )}

      {step === 'done' && aiResult && (
        <div className={`rounded-xl border-2 p-5 text-center ${aiResult.match ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          {aiResult.match ? (
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
          ) : (
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-500" />
          )}
          <p className={`font-bold text-lg ${aiResult.match ? 'text-green-700' : 'text-red-700'}`}>
            {aiResult.match ? 'Delivery Confirmed!' : 'Flagged for Manual Review'}
          </p>
          <p className="text-sm text-gray-600 mt-2">{aiResult.reason}</p>
          <Button className="mt-4" onClick={() => router.push('/rider/dashboard')}>
            Back to Queue
          </Button>
        </div>
      )}

      {(order.status === 'delivered' || order.status === 'needs_manual_review') && step === 'overview' && (
        <div className={`rounded-xl border-2 p-4 text-center ${order.status === 'delivered' ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
          {order.status === 'delivered' ? (
            <p className="font-semibold text-green-700">✓ Already delivered</p>
          ) : (
            <p className="font-semibold text-orange-700">⚠ Flagged for manual review</p>
          )}
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

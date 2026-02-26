'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, RotateCcw, XCircle, AlertTriangle, Bot, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatInvoiceNo } from '@/lib/utils';

interface Props {
  order: Order;
  onClose: () => void;
  onResolved: (orderId: string, newStatus: string) => void;
}

export function ManualReviewModal({ order, onClose, onResolved }: Props) {
  const [notes, setNotes] = useState(order.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [podSignedUrl, setPodSignedUrl] = useState<string | null>(null);
  const [podLoading, setPodLoading] = useState(false);
  const supabase = createClient();

  // pod bucket is private — generate a signed URL from the stored path
  useEffect(() => {
    if (!order.pod_image_url) return;
    setPodLoading(true);

    // Extract the object path from the stored URL.
    // Stored URL format: https://[ref].supabase.co/storage/v1/object/public/pod/[path]
    const marker = '/object/public/pod/';
    const markerIdx = order.pod_image_url.indexOf(marker);
    const path = markerIdx !== -1
      ? order.pod_image_url.slice(markerIdx + marker.length)
      : null;

    if (!path) {
      // URL doesn't match expected format — use as-is
      setPodSignedUrl(order.pod_image_url);
      setPodLoading(false);
      return;
    }

    supabase.storage.from('pod').createSignedUrl(path, 3600).then(({ data, error }) => {
      if (data?.signedUrl) {
        setPodSignedUrl(data.signedUrl);
      } else {
        console.error('Signed URL error:', error);
        setPodSignedUrl(null);
      }
      setPodLoading(false);
    });
  }, [order.pod_image_url]);

  const invoiceLabel = order.invoice_no
    ? formatInvoiceNo(order.invoice_prefix, order.invoice_no)
    : `#${order.id.slice(0, 8).toUpperCase()}`;

  const aiResult = order.pod_ai_result;

  const handleAction = async (newStatus: 'delivered' | 'out_for_delivery' | 'cancelled') => {
    if (!notes.trim()) {
      toast.error('Please add a note explaining your decision before proceeding');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, notes })
      .eq('id', order.id);

    if (error) {
      toast.error('Failed to update order');
    } else {
      const labels: Record<string, string> = {
        delivered: 'Order confirmed as delivered',
        out_for_delivery: 'Order returned to rider queue',
        cancelled: 'Order cancelled',
      };
      toast.success(labels[newStatus]);
      onResolved(order.id, newStatus);
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">Manual Review</h2>
            <span className="text-sm text-gray-400 font-mono">{invoiceLabel}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* AI Result card */}
          <div className={`rounded-xl p-4 border-2 ${
            aiResult?.match
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Bot className={`h-4 w-4 ${aiResult?.match ? 'text-green-600' : 'text-red-500'}`} />
              <span className="text-sm font-semibold text-gray-800">AI Verification</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                aiResult?.match
                  ? 'bg-green-200 text-green-800'
                  : 'bg-red-200 text-red-800'
              }`}>
                {aiResult?.match ? 'MATCHED' : 'NO MATCH'}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {aiResult?.reason ?? 'No AI reason available.'}
            </p>
          </div>

          {/* POD photo */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-700">Proof of Delivery Photo</p>
            </div>
            {!order.pod_image_url ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-400">
                <Camera className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No proof of delivery photo</p>
              </div>
            ) : podLoading ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 h-48 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : podSignedUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={podSignedUrl}
                  alt="Proof of delivery"
                  className="w-full rounded-xl border border-gray-200 object-contain max-h-[420px] bg-gray-50"
                />
                <a
                  href={podSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs mt-1.5 inline-block hover:underline"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  Open full size ↗
                </a>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-red-200 p-6 text-center text-red-400">
                <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Could not load photo</p>
                <p className="text-xs text-gray-400 mt-1">The signed URL may have expired. Re-open to retry.</p>
              </div>
            )}
          </div>

          {/* Admin notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Admin Notes
              <span className="text-red-500 ml-1">*</span>
              <span className="text-xs font-normal text-gray-400 ml-2">Required — explain your decision</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 'Photo verified manually, customer confirmed receipt by phone. Invoice number visible in image.'"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <Button
              className="gap-2"
              onClick={() => handleAction('delivered')}
              disabled={saving}
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Delivered
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleAction('out_for_delivery')}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4" />
              Return to Rider
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => handleAction('cancelled')}
              disabled={saving}
            >
              <XCircle className="h-4 w-4" />
              Cancel Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

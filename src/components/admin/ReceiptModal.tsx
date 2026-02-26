'use client';
import { useRef } from 'react';
import { Order, Settings } from '@/types';
import { formatCurrency, formatDate, formatInvoiceNo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

interface ReceiptModalProps {
  order: Order;
  settings: Settings | null;
  onClose: () => void;
}

export function ReceiptModal({ order, settings, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Receipt – ${formatInvoiceNo(order.invoice_prefix, order.invoice_no)}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 11pt; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
            .company-name { font-size: 22pt; font-weight: bold; text-transform: uppercase; }
            .bir-details { font-size: 9pt; color: #333; margin-top: 4px; }
            .si-number { font-size: 36pt; font-weight: 900; text-align: center; border: 4px solid #000; padding: 12px; margin: 16px 0; letter-spacing: 4px; background: #f8f8f8; }
            .si-label { font-size: 10pt; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
            .section-title { font-weight: bold; font-size: 10pt; border-bottom: 1px dashed #999; padding-bottom: 4px; margin: 12px 0 6px; }
            .row { display: flex; justify-content: space-between; font-size: 10pt; padding: 2px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .items-table th { text-align: left; font-size: 9pt; padding: 4px 6px; border-bottom: 1px solid #000; }
            .items-table th:last-child, .items-table td:last-child { text-align: right; }
            .items-table td { font-size: 10pt; padding: 4px 6px; }
            .items-table tr:nth-child(even) { background: #f5f5f5; }
            .total-section { border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
            .total-row { display: flex; justify-content: space-between; font-size: 11pt; padding: 2px 0; }
            .grand-total { font-size: 14pt; font-weight: bold; border-top: 1px solid #000; margin-top: 6px; padding-top: 6px; }
            .footer { text-align: center; font-size: 9pt; margin-top: 20px; color: #555; border-top: 1px dashed #999; padding-top: 10px; }
            .cod-box { border: 3px double #000; padding: 10px; text-align: center; margin: 12px 0; }
            .cod-amount { font-size: 20pt; font-weight: bold; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const companyName = settings?.company_name ?? 'QuickMed';
  const items = (order.order_items ?? []) as Array<{
    id: string; product_id: string; quantity: number; unit_price: number; subtotal: number;
    product?: { brand_name: string; generic_name: string };
  }>;

  // VAT breakdown (tax-inclusive computation per BIR)
  const vatableAmount = order.subtotal;
  const vatAmount = order.vat_amount;
  const lessDiscount = order.discount_amount;
  const invoiceDisplay = formatInvoiceNo(order.invoice_prefix, order.invoice_no);
  const customer = order.customer as unknown as { full_name?: string; phone?: string } | null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b no-print">
          <h2 className="font-semibold text-gray-900">Receipt Preview</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Receipt body (also used for printing) */}
        <div ref={printRef} className="p-8 font-mono text-sm">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <p className="text-2xl font-black uppercase tracking-wider">{companyName}</p>
            {settings?.base_address && (
              <p className="text-xs text-gray-600 mt-1">{settings.base_address}</p>
            )}
            {settings?.bir_tin && (
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                <p>TIN: {settings.bir_tin}</p>
                {settings.bir_accreditation_no && <p>Accreditation No.: {settings.bir_accreditation_no}</p>}
                {settings.bir_permit_no && <p>Permit No.: {settings.bir_permit_no}</p>}
              </div>
            )}
          </div>

          {/* SI Number – Large & High-Contrast */}
          <div className="border-4 border-black bg-gray-50 p-4 mb-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] mb-2 font-bold">Sales Invoice Number</p>
            <p className="text-4xl font-black tracking-[0.2em]">{invoiceDisplay}</p>
          </div>

          {/* Bill to */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
            <div>
              <p className="font-bold uppercase mb-1">Bill To:</p>
              <p>{customer?.full_name ?? 'Walk-in Customer'}</p>
              {customer?.phone && <p>{customer.phone}</p>}
              <p className="mt-1">{order.delivery_address}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold">Date:</span> {formatDate(order.created_at)}</p>
              {order.delivery_date && (
                <p><span className="font-bold">Delivery:</span> {formatDate(order.delivery_date)}</p>
              )}
              <p className="mt-1"><span className="font-bold">Payment:</span> Cash on Delivery</p>
            </div>
          </div>

          {/* Items */}
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="border-b border-t border-black">
                <th className="text-left py-1.5 text-xs uppercase">Item</th>
                <th className="text-right py-1.5 text-xs uppercase">Qty</th>
                <th className="text-right py-1.5 text-xs uppercase">Unit Price</th>
                <th className="text-right py-1.5 text-xs uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1.5 text-xs">
                    <p className="font-semibold">{item.product?.brand_name ?? '—'}</p>
                    <p className="text-gray-500">{item.product?.generic_name ?? ''}</p>
                  </td>
                  <td className="py-1.5 text-right text-xs">{item.quantity}</td>
                  <td className="py-1.5 text-right text-xs">{formatCurrency(item.unit_price)}</td>
                  <td className="py-1.5 text-right text-xs font-semibold">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t-2 border-black pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Vatable Sales</span>
              <span>{formatCurrency(vatableAmount / 1.12)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT (12%)</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal (incl. VAT)</span>
              <span>{formatCurrency(vatableAmount + vatAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span>{formatCurrency(order.delivery_fee)}</span>
            </div>
            {lessDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount ({order.discount_type === 'senior' ? 'Senior Citizen' : 'PWD'})</span>
                <span>-{formatCurrency(lessDiscount)}</span>
              </div>
            )}
          </div>

          {/* COD Total box */}
          <div className="border-4 border-double border-black mt-3 p-3 text-center">
            <p className="text-xs uppercase tracking-widest font-bold mb-1">Cash on Delivery Total</p>
            <p className="text-3xl font-black">{formatCurrency(order.cod_total)}</p>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 mt-6 border-t border-dashed border-gray-300 pt-4">
            <p>This serves as your Official Receipt.</p>
            {settings?.bir_tin && <p>TIN: {settings.bir_tin}</p>}
            <p className="mt-2">Thank you for choosing {companyName}!</p>
            <p className="mt-1 italic">Generated: {new Date().toLocaleString('en-PH')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatInvoiceNo(prefix: string | null, no: number | null): string {
  if (!no) return 'N/A';
  const p = prefix ?? 'SI';
  return `${p}-${String(no).padStart(8, '0')}`;
}

export function getOrderStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    packed: 'bg-blue-100 text-blue-800',
    out_for_delivery: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    needs_manual_review: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

export function getOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    packed: 'Packed',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    needs_manual_review: 'Needs Manual Review',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

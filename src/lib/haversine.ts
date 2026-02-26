/**
 * Haversine formula – straight-line distance between two lat/lng points in km.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Compute delivery fee: distance × rate per km (minimum ₱0)
 */
export function computeDeliveryFee(
  customerLat: number,
  customerLng: number,
  baseLat: number,
  baseLng: number,
  feePerKm: number
): { distanceKm: number; deliveryFee: number } {
  const distanceKm = haversineDistance(baseLat, baseLng, customerLat, customerLng);
  const deliveryFee = Math.max(0, Math.round(distanceKm * feePerKm * 100) / 100);
  return { distanceKm, deliveryFee };
}

/**
 * Compute VAT-inclusive pricing (Philippine 12% VAT)
 */
export function computeVAT(subtotal: number): {
  vatExclusive: number;
  vatAmount: number;
  vatInclusive: number;
} {
  const vatAmount = Math.round(subtotal * 0.12 * 100) / 100;
  return {
    vatExclusive: subtotal,
    vatAmount,
    vatInclusive: subtotal + vatAmount,
  };
}

/**
 * Senior Citizen / PWD discount (20% off subtotal, VAT-exempt)
 */
export function applySeniorPWDDiscount(subtotal: number): number {
  return Math.round(subtotal * 0.2 * 100) / 100;
}

'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-72 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
      <span className="animate-pulse">Loading map…</span>
    </div>
  ),
});

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number, address?: string) => void;
  defaultCenter?: [number, number];
  height?: string;
}

export function LocationPicker({ lat, lng, onChange, defaultCenter, height }: LocationPickerProps) {
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleMapClick = async (newLat: number, newLng: number) => {
    onChange(newLat, newLng);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const addr = data?.display_name ?? '';
      setAddress(addr);
      onChange(newLat, newLng, addr);
    } catch {
      // ignore reverse geocoding errors
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=ph`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const results = await res.json();
      if (results?.[0]) {
        const newLat = Number(results[0].lat);
        const newLng = Number(results[0].lon);
        const addr = results[0].display_name as string;
        setAddress(addr);
        onChange(newLat, newLng, addr);
      } else {
        toast.error('Location not found. Try a more specific address.');
      }
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const center: [number, number] = defaultCenter ?? [14.5995, 120.9842];

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address or landmark…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={searching} className="gap-1.5">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      <MapComponent
        lat={lat}
        lng={lng}
        onMapClick={handleMapClick}
        defaultCenter={center}
        height={height}
      />

      {address && (
        <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 rounded-lg p-3">
          <MapPin className="h-4 w-4 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
          <span>{address}</span>
        </div>
      )}
      {!address && lat !== 0 && (
        <p className="text-xs text-gray-400 text-center">
          Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)} — or click the map to reposition
        </p>
      )}
    </div>
  );
}

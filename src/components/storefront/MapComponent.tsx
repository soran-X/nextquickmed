'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

interface MapComponentProps {
  lat: number;
  lng: number;
  onMapClick: (lat: number, lng: number) => void;
  defaultCenter: [number, number];
  readOnly?: boolean;
  markers?: Array<{ lat: number; lng: number; popup?: string }>;
  height?: string;
}

export default function MapComponent({
  lat,
  lng,
  onMapClick,
  defaultCenter,
  readOnly = false,
  markers,
  height = '288px',
}: MapComponentProps) {
  const center: [number, number] = lat && lng ? [lat, lng] : defaultCenter;

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height, width: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {!readOnly && <ClickHandler onMapClick={onMapClick} />}
      {lat && lng && <Marker position={[lat, lng]} />}
      {markers?.map((m, i) => (
        <Marker key={i} position={[m.lat, m.lng]} />
      ))}
      <RecenterMap lat={lat} lng={lng} />
    </MapContainer>
  );
}

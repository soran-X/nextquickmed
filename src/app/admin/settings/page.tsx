'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Settings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Upload, Palette, MapPin, Receipt, Truck } from 'lucide-react';

import { LocationPicker } from '@/components/storefront/LocationPicker';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      let logoUrl = settings.logo_url;

      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logo.${ext}`;
        const { error } = await supabase.storage.from('branding').upload(path, logoFile, { upsert: true });
        if (!error) {
          const { data } = supabase.storage.from('branding').getPublicUrl(path);
          logoUrl = data.publicUrl;
        }
      }

      const { error } = await supabase.from('settings').update({
        ...settings,
        logo_url: logoUrl,
      }).eq('id', 1);

      if (error) throw error;
      toast.success('Settings saved successfully');
      // Refresh page to apply new branding
      window.location.reload();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const f = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, [key]: e.target.value }));
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save All Changes'}
        </Button>
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="mb-6">
          <TabsTrigger value="branding"><Palette className="h-4 w-4 mr-2" />Branding</TabsTrigger>
          <TabsTrigger value="location"><MapPin className="h-4 w-4 mr-2" />Location</TabsTrigger>
          <TabsTrigger value="bir"><Receipt className="h-4 w-4 mr-2" />BIR / Invoice</TabsTrigger>
          <TabsTrigger value="delivery"><Truck className="h-4 w-4 mr-2" />Delivery</TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 max-w-2xl">
            <div>
              <Label>Company Name</Label>
              <Input className="mt-1" value={settings.company_name ?? ''} onChange={f('company_name')} />
            </div>

            <div>
              <Label>Logo</Label>
              {settings.logo_url && (
                <div className="mt-2 mb-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={settings.logo_url} alt="Current logo" className="h-12 object-contain border rounded p-1" />
                  <span className="text-xs text-gray-400">Current logo</span>
                </div>
              )}
              <input type="file" accept="image/*,.svg"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="block mt-1 text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700" />
              <p className="text-xs text-gray-400 mt-1">SVG, PNG, or JPG. Recommended size: 200×50px</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2 mt-1 items-center">
                  <input type="color" value={settings.primary_color ?? '#0ea5e9'}
                    onChange={(e) => setSettings((p) => ({ ...p, primary_color: e.target.value }))}
                    className="h-10 w-10 rounded cursor-pointer border border-gray-300" />
                  <Input value={settings.primary_color ?? ''} onChange={f('primary_color')} className="flex-1 font-mono" />
                </div>
              </div>
              <div>
                <Label>Secondary Color</Label>
                <div className="flex gap-2 mt-1 items-center">
                  <input type="color" value={settings.secondary_color ?? '#0284c7'}
                    onChange={(e) => setSettings((p) => ({ ...p, secondary_color: e.target.value }))}
                    className="h-10 w-10 rounded cursor-pointer border border-gray-300" />
                  <Input value={settings.secondary_color ?? ''} onChange={f('secondary_color')} className="flex-1 font-mono" />
                </div>
              </div>
              <div>
                <Label>Tertiary Color</Label>
                <div className="flex gap-2 mt-1 items-center">
                  <input type="color" value={settings.tertiary_color ?? '#f0f9ff'}
                    onChange={(e) => setSettings((p) => ({ ...p, tertiary_color: e.target.value }))}
                    className="h-10 w-10 rounded cursor-pointer border border-gray-300" />
                  <Input value={settings.tertiary_color ?? ''} onChange={f('tertiary_color')} className="flex-1 font-mono" />
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="border rounded-xl p-4 mt-2" style={{ background: settings.tertiary_color ?? '#f0f9ff' }}>
              <p className="text-sm font-semibold" style={{ color: settings.primary_color ?? '#0ea5e9' }}>
                Brand Preview – {settings.company_name ?? 'QuickMed'}
              </p>
              <p className="text-xs mt-1" style={{ color: settings.secondary_color ?? '#0284c7' }}>
                This is how your colors will look across the app
              </p>
              <div className="flex gap-2 mt-3">
                <button className="px-3 py-1.5 rounded-md text-white text-xs font-medium" style={{ background: settings.primary_color ?? '#0ea5e9' }}>
                  Primary Button
                </button>
                <button className="px-3 py-1.5 rounded-md text-white text-xs font-medium" style={{ background: settings.secondary_color ?? '#0284c7' }}>
                  Secondary Button
                </button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-2xl">
            <p className="text-sm text-gray-600">
              Set your pharmacy&apos;s base location. This is used to calculate delivery distances and fees.
            </p>
            <LocationPicker
              lat={Number(settings.base_lat) || 14.5995}
              lng={Number(settings.base_lng) || 120.9842}
              onChange={(lat, lng, addr) =>
                setSettings((p) => ({
                  ...p,
                  base_lat: lat,
                  base_lng: lng,
                  ...(addr ? { base_address: addr } : {}),
                }))
              }
              defaultCenter={[
                Number(settings.base_lat) || 14.5995,
                Number(settings.base_lng) || 120.9842,
              ]}
              height="320px"
            />
            <div>
              <Label>Address Label</Label>
              <Input
                className="mt-1"
                placeholder="e.g. 123 Rizal Ave, Manila"
                value={settings.base_address ?? ''}
                onChange={f('base_address')}
              />
              <p className="text-xs text-gray-400 mt-1">
                Filled automatically when you search or click the map. You can edit it manually.
              </p>
            </div>
            {settings.base_lat && settings.base_lng && (
              <p className="text-xs text-gray-500 font-mono">
                Saved pin: {Number(settings.base_lat).toFixed(6)}, {Number(settings.base_lng).toFixed(6)}
              </p>
            )}
          </div>
        </TabsContent>

        {/* BIR Tab */}
        <TabsContent value="bir">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-2xl">
            <p className="text-sm text-gray-600">
              BIR details appear on all printed receipts and sales invoices.
            </p>
            <div>
              <Label>TIN (Tax Identification Number)</Label>
              <Input className="mt-1 font-mono" placeholder="000-000-000-000"
                value={settings.bir_tin ?? ''} onChange={f('bir_tin')} />
            </div>
            <div>
              <Label>BIR Accreditation Number</Label>
              <Input className="mt-1 font-mono"
                value={settings.bir_accreditation_no ?? ''} onChange={f('bir_accreditation_no')} />
            </div>
            <div>
              <Label>BIR Permit Number</Label>
              <Input className="mt-1 font-mono"
                value={settings.bir_permit_no ?? ''} onChange={f('bir_permit_no')} />
            </div>
            <div>
              <Label>Invoice Serial Number Start</Label>
              <Input className="mt-1 font-mono" type="number" min="1"
                value={settings.bir_serial_no_start ?? 1000} onChange={f('bir_serial_no_start')} />
              <p className="text-xs text-gray-400 mt-1">
                Current invoice counter: {(settings.last_invoice_no ?? 0) + (Number(settings.bir_serial_no_start) ?? 1000)}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-lg">
            <div>
              <Label>Delivery Fee per KM (₱)</Label>
              <Input className="mt-1" type="number" min="0" step="0.5"
                value={settings.delivery_fee_per_km ?? 15}
                onChange={f('delivery_fee_per_km')} />
              <p className="text-xs text-gray-400 mt-1">
                Example: ₱{settings.delivery_fee_per_km ?? 15}/km × 5km = ₱{(Number(settings.delivery_fee_per_km ?? 15) * 5).toFixed(2)} delivery fee
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

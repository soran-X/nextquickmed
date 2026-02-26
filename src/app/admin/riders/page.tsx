'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Rider, Profile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Bike, User } from 'lucide-react';

type RiderWithProfile = Rider & { profile: Profile };

const EMPTY_FORM = {
  full_name: '', email: '', phone: '', password: '',
  plate_no: '', license_no: '', vehicle_type: 'motorcycle',
};

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<RiderWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RiderWithProfile | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchRiders = async () => {
    const { data } = await supabase
      .from('riders')
      .select('*, profile:profiles!user_id(full_name, phone, id)')
      .order('created_at', { ascending: false });
    setRiders((data ?? []) as unknown as RiderWithProfile[]);
    setLoading(false);
  };

  useEffect(() => { fetchRiders(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setProfilePicFile(null);
    setDialogOpen(true);
  };

  const openEdit = (r: RiderWithProfile) => {
    setEditing(r);
    setForm({
      full_name: r.profile?.full_name ?? '',
      email: '', password: '',
      phone: r.profile?.phone ?? '',
      plate_no: r.plate_no,
      license_no: r.license_no,
      vehicle_type: r.vehicle_type,
    });
    setProfilePicFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.plate_no || !form.license_no) {
      toast.error('Plate number and license number are required');
      return;
    }
    setSaving(true);

    try {
      let userId = editing?.user_id;

      if (!editing) {
        // Create auth user for rider
        if (!form.email || !form.password) {
          toast.error('Email and password required for new riders');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/admin/create-rider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name, phone: form.phone }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to create rider account');
        userId = data.userId;
      } else {
        // Update profile
        await supabase.from('profiles').update({
          full_name: form.full_name,
          phone: form.phone,
        }).eq('id', editing.user_id);
      }

      // Upload profile pic
      let profilePicUrl = editing?.profile_pic ?? null;
      if (profilePicFile && userId) {
        const ext = profilePicFile.name.split('.').pop();
        const path = `${userId}/profile.${ext}`;
        const { error } = await supabase.storage.from('riders').upload(path, profilePicFile, { upsert: true });
        if (!error) {
          const { data } = supabase.storage.from('riders').getPublicUrl(path);
          profilePicUrl = data.publicUrl;
        }
      }

      const riderPayload = {
        plate_no: form.plate_no,
        license_no: form.license_no,
        vehicle_type: form.vehicle_type,
        profile_pic: profilePicUrl,
      };

      if (editing) {
        await supabase.from('riders').update(riderPayload).eq('id', editing.id);
        toast.success('Rider updated');
      } else {
        await supabase.from('riders').insert({ user_id: userId, ...riderPayload });
        toast.success('Rider created');
      }

      setDialogOpen(false);
      fetchRiders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save rider');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (r: RiderWithProfile) => {
    await supabase.from('riders').update({ is_active: !r.is_active }).eq('id', r.id);
    fetchRiders();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Riders</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Rider
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Bike className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No riders yet. Add your first rider.</p>
            </div>
          )}
          {riders.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                {r.profile_pic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.profile_pic} alt={r.profile?.full_name ?? ''} className="h-14 w-14 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-7 w-7 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{r.profile?.full_name ?? 'Rider'}</p>
                  <Badge variant={r.is_active ? 'success' : 'secondary'} className="text-xs">
                    {r.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Bike className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-mono font-semibold">{r.plate_no}</span>
                  <span className="text-gray-400">|</span>
                  <span className="capitalize text-xs">{r.vehicle_type}</span>
                </div>
                <p className="text-xs text-gray-400">License: {r.license_no}</p>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="flex-1 gap-1">
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant={r.is_active ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleActive(r)}
                  className="flex-1 text-xs"
                >
                  {r.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rider Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Rider' : 'Add Rider'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {!editing && (
              <>
                <div>
                  <Label>Email *</Label>
                  <Input className="mt-1" type="email" placeholder="rider@example.com"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input className="mt-1" type="password" placeholder="Min. 8 characters"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <Label>Full Name</Label>
              <Input className="mt-1" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="mt-1" type="tel" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plate Number *</Label>
                <Input className="mt-1 font-mono uppercase" value={form.plate_no}
                  onChange={(e) => setForm({ ...form, plate_no: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label>License No. *</Label>
                <Input className="mt-1 font-mono" value={form.license_no}
                  onChange={(e) => setForm({ ...form, license_no: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Vehicle Type</Label>
              <select
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                className="mt-1 w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
              </select>
            </div>
            <div>
              <Label>Profile Photo</Label>
              <input type="file" accept="image/*"
                onChange={(e) => setProfilePicFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Saving…' : (editing ? 'Update Rider' : 'Create Rider')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

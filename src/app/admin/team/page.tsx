'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Mail, Shield, Bike, User, RefreshCw } from 'lucide-react';

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-800',
  rider: 'bg-blue-100 text-blue-800',
  customer: 'bg-gray-100 text-gray-700',
};

const ROLE_ICONS = {
  admin: Shield,
  rider: Bike,
  customer: User,
};

export default function AdminTeamPage() {
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'rider'>('admin');
  const [inviting, setInviting] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const supabase = createClient();

  const fetchTeam = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'rider'])
      .order('role')
      .order('full_name');
    setTeam((data ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to send invite');
    } else {
      toast.success(`Invite sent to ${data.email}`, {
        description: `They will receive an email to activate their ${inviteRole} account.`,
      });
      setInviteEmail('');
      setInviteOpen(false);
    }
    setInviting(false);
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'rider' | 'customer') => {
    setChangingRole(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) toast.error('Failed to update role');
    else { toast.success('Role updated'); fetchTeam(); }
    setChangingRole(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Invite admins and manage team roles</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={fetchTeam} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Invite Team Member
          </Button>
        </div>
      </div>

      {/* Team grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Contact</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {team.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400">
                    No team members yet. Invite your first admin.
                  </td>
                </tr>
              )}
              {team.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role];
                return (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                          style={{ backgroundColor: 'var(--brand-primary)' }}>
                          {(member.full_name ?? '?')[0].toUpperCase()}
                        </div>
                        <p className="font-medium text-gray-900">{member.full_name ?? '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{member.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                        <RoleIcon className="h-3 w-3" />
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.id, v as 'admin' | 'rider' | 'customer')}
                        disabled={changingRole === member.id}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="rider">Rider</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 py-2">
            <div>
              <Label htmlFor="invite-email">Email Address</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                They will receive an email with a magic link to activate their account.
              </p>
            </div>

            <div>
              <Label>Role</Label>
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setInviteRole('admin')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors flex flex-col items-center gap-1 ${
                    inviteRole === 'admin'
                      ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-blue-50'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Shield className="h-5 w-5" />
                  Admin
                  <span className="text-xs font-normal text-gray-400">Full access</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole('rider')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors flex flex-col items-center gap-1 ${
                    inviteRole === 'rider'
                      ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-blue-50'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Bike className="h-5 w-5" />
                  Rider
                  <span className="text-xs font-normal text-gray-400">Delivery app</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={inviting} className="flex-1 gap-2">
                <Mail className="h-4 w-4" />
                {inviting ? 'Sending…' : `Send Invite`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

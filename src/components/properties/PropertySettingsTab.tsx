import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Phone, 
  Bell, 
  Users, 
  UserPlus, 
  Loader2, 
  Mail,
  Trash2,
  Check,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface PropertyMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

interface PropertySettingsTabProps {
  propertyId: string;
  ownerName: string | null;
  ownerPhone: string | null;
  smsEnabled: boolean | null;
  onUpdate: () => void;
}

export const PropertySettingsTab = ({
  propertyId,
  ownerName,
  ownerPhone,
  smsEnabled,
  onUpdate,
}: PropertySettingsTabProps) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<PropertyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);

  // Form state
  const [formOwnerName, setFormOwnerName] = useState(ownerName || '');
  const [formOwnerPhone, setFormOwnerPhone] = useState(ownerPhone || '');
  const [formSmsEnabled, setFormSmsEnabled] = useState(smsEnabled || false);

  useEffect(() => {
    fetchMembers();
  }, [propertyId]);

  useEffect(() => {
    setFormOwnerName(ownerName || '');
    setFormOwnerPhone(ownerPhone || '');
    setFormSmsEnabled(smsEnabled || false);
  }, [ownerName, ownerPhone, smsEnabled]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('property_members')
        .select('*')
        .eq('property_id', propertyId)
        .neq('status', 'removed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSaveOwnerSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          owner_name: formOwnerName || null,
          owner_phone: formOwnerPhone || null,
          sms_enabled: formSmsEnabled,
        })
        .eq('id', propertyId);

      if (error) throw error;
      toast.success('Settings saved');
      onUpdate();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail || !user) return;

    setInviting(true);
    try {
      const { error } = await supabase.from('property_members').insert({
        property_id: propertyId,
        user_id: user.id, // Will be updated when they accept
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        invited_by: user.id,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('This person has already been invited');
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('viewer');
      setInviteOpen(false);
      fetchMembers();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('property_members')
        .update({ status: 'removed' })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member removed');
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-primary/10 text-primary border-primary/20';
      case 'manager': return 'bg-accent/10 text-accent border-accent/20';
      case 'super': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Owner & Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="w-5 h-5 text-primary" />
            Owner & Contact
          </CardTitle>
          <CardDescription>
            Owner information for this property. This info is used for SMS alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner / Entity Name</Label>
              <Input
                id="owner_name"
                placeholder="e.g., ABC Realty LLC"
                value={formOwnerName}
                onChange={(e) => setFormOwnerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_phone">Owner Phone</Label>
              <Input
                id="owner_phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formOwnerPhone}
                onChange={(e) => setFormOwnerPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This number receives SMS alerts for new violations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-primary" />
            SMS Alerts
          </CardTitle>
          <CardDescription>
            Get instant text messages when new violations are detected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="font-medium">Enable SMS Alerts</p>
              <p className="text-sm text-muted-foreground">
                {formOwnerPhone 
                  ? `Alerts will be sent to ${formOwnerPhone}` 
                  : 'Add an owner phone number above to enable'}
              </p>
            </div>
            <Switch
              checked={formSmsEnabled}
              onCheckedChange={setFormSmsEnabled}
              disabled={!formOwnerPhone}
            />
          </div>

          <Button 
            onClick={handleSaveOwnerSettings} 
            className="mt-4"
            disabled={saving}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                Team Members
              </CardTitle>
              <CardDescription>
                Invite property managers, supers, or other team members
              </CardDescription>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite_email">Email Address</Label>
                    <Input
                      id="invite_email"
                      type="email"
                      placeholder="team@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite_role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">
                          <div className="flex flex-col items-start">
                            <span>Manager</span>
                            <span className="text-xs text-muted-foreground">
                              Full access to property data
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="super">
                          <div className="flex flex-col items-start">
                            <span>Super / Maintenance</span>
                            <span className="text-xs text-muted-foreground">
                              View violations and work orders
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div className="flex flex-col items-start">
                            <span>Viewer</span>
                            <span className="text-xs text-muted-foreground">
                              Read-only access
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleInviteMember} 
                    className="w-full"
                    disabled={!inviteEmail || inviting}
                  >
                    {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : members.length > 0 ? (
            <div className="space-y-3">
              {members.map((member) => (
                <div 
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                        {member.status === 'pending' ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : (
                          <span className="text-xs text-success flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No team members yet</p>
              <p className="text-xs">Invite managers or supers to collaborate</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

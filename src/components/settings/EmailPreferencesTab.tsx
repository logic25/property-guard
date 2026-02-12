import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, Send, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmailPreferences {
  digest_frequency: string;
  digest_day: string;
  notify_new_violations: boolean;
  notify_status_changes: boolean;
  notify_expirations: boolean;
  notify_new_applications: boolean;
}

const defaultPrefs: EmailPreferences = {
  digest_frequency: 'none',
  digest_day: 'monday',
  notify_new_violations: true,
  notify_status_changes: true,
  notify_expirations: true,
  notify_new_applications: true,
};

const EmailPreferencesTab = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<EmailPreferences>(defaultPrefs);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    const fetchPrefs = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('email_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          setPrefs({
            digest_frequency: (data as any).digest_frequency || 'none',
            digest_day: (data as any).digest_day || 'monday',
            notify_new_violations: (data as any).notify_new_violations ?? true,
            notify_status_changes: (data as any).notify_status_changes ?? true,
            notify_expirations: (data as any).notify_expirations ?? true,
            notify_new_applications: (data as any).notify_new_applications ?? true,
          });
        }
      } catch (err) {
        console.error('Error fetching email prefs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrefs();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('email_preferences')
        .upsert({
          user_id: user.id,
          email: user.email,
          ...prefs,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Email preferences saved');
    } catch (err) {
      console.error('Error saving email prefs:', err);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!user) return;
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-digest', {
        body: { user_id: user.id, test_mode: true },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Test digest sent to your email!');
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error sending test:', err);
      toast.error(`Failed to send test: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handlePreview = async () => {
    if (!user) return;
    setIsLoadingPreview(true);
    setShowPreview(true);
    try {
      const response = await supabase.functions.invoke('send-email-digest', {
        body: { user_id: user.id, preview_only: true },
      });
      // The response will be HTML string
      if (response.error) throw response.error;
      // The edge function returns HTML directly in preview mode
      const html = typeof response.data === 'string' ? response.data : response.data?.toString() || '<p>Unable to generate preview</p>';
      setPreviewHtml(html);
    } catch (err: any) {
      console.error('Error loading preview:', err);
      setPreviewHtml(`<div style="padding:40px;text-align:center;color:#ef4444;">Error loading preview: ${err.message}</div>`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const digestEnabled = prefs.digest_frequency !== 'none';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Digest Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Weekly Email Digest
            </CardTitle>
            <CardDescription>
              Receive a beautiful summary of all compliance activity across your properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Enable Weekly Digest</p>
                <p className="text-sm text-muted-foreground">
                  Get a compliance summary delivered to {user?.email}
                </p>
              </div>
              <Switch
                checked={digestEnabled}
                onCheckedChange={(checked) =>
                  setPrefs({ ...prefs, digest_frequency: checked ? 'weekly' : 'none' })
                }
              />
            </div>

            {digestEnabled && (
              <>
                {/* Frequency + Day */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={prefs.digest_frequency}
                      onValueChange={(v) => setPrefs({ ...prefs, digest_frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {prefs.digest_frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Send On</Label>
                      <Select
                        value={prefs.digest_day}
                        onValueChange={(v) => setPrefs({ ...prefs, digest_day: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monday">Monday</SelectItem>
                          <SelectItem value="tuesday">Tuesday</SelectItem>
                          <SelectItem value="wednesday">Wednesday</SelectItem>
                          <SelectItem value="thursday">Thursday</SelectItem>
                          <SelectItem value="friday">Friday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Content Checkboxes */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Include in Digest
                  </Label>
                  <div className="space-y-3">
                    {[
                      { key: 'notify_new_violations' as const, label: 'Active violations', desc: 'Open violations with severity and hearing dates' },
                      { key: 'notify_status_changes' as const, label: 'Status changes', desc: 'Violations and applications that changed status' },
                      { key: 'notify_expirations' as const, label: 'Expiring documents & permits', desc: 'Documents expiring within 7 days' },
                      { key: 'notify_new_applications' as const, label: 'Application updates', desc: 'Recent DOB/FDNY/HPD application filings' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <Checkbox
                          checked={prefs[key]}
                          onCheckedChange={(checked) =>
                            setPrefs({ ...prefs, [key]: !!checked })
                          }
                          className="mt-0.5"
                        />
                        <div>
                          <p className="font-medium text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Preferences
              </Button>
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="w-4 h-4 mr-2" />
                Preview Email
              </Button>
              <Button variant="outline" onClick={handleSendTest} disabled={isSendingTest}>
                {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Test Email
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Other notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Real-time Notifications</CardTitle>
            <CardDescription>Instant alerts for critical compliance events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">SMS Notifications</p>
                <p className="text-sm text-muted-foreground">Urgent alerts via text message</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Critical Alerts</p>
                <p className="text-sm text-muted-foreground">Immediate email for stop work orders & vacate orders</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Digest Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/30">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[600px] border-0"
                title="Email Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailPreferencesTab;

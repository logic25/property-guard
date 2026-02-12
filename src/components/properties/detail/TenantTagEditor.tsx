import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { User, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TenantTagEditorProps {
  appId: string;
  initialTenantName: string | null;
  initialTenantNotes: string | null;
}

export const TenantTagEditor = ({ appId, initialTenantName, initialTenantNotes }: TenantTagEditorProps) => {
  const [tenantName, setTenantName] = useState(initialTenantName || '');
  const [tenantNotes, setTenantNotes] = useState(initialTenantNotes || '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('applications')
      .update({ tenant_name: tenantName || null, tenant_notes: tenantNotes || null })
      .eq('id', appId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save tenant tag');
    } else {
      setDirty(false);
      toast.success('Tenant tag saved');
    }
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5 px-2 h-7">
          <User className="w-3 h-3" />
          Tenant {initialTenantName ? `• ${initialTenantName}` : ''}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="space-y-2">
          <Input
            placeholder="Tenant name"
            value={tenantName}
            onChange={(e) => { setTenantName(e.target.value); setDirty(true); }}
            className="text-sm h-8"
          />
          <Textarea
            placeholder="Tenant notes..."
            value={tenantNotes}
            onChange={(e) => { setTenantNotes(e.target.value); setDirty(true); }}
            className="min-h-[40px] text-sm"
          />
          {dirty && (
            <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Save
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

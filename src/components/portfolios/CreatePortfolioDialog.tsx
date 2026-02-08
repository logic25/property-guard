import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CreatePortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editPortfolio?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export const CreatePortfolioDialog = ({
  open,
  onOpenChange,
  onSuccess,
  editPortfolio,
}: CreatePortfolioDialogProps) => {
  const [name, setName] = useState(editPortfolio?.name || '');
  const [description, setDescription] = useState(editPortfolio?.description || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter a portfolio name');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editPortfolio) {
        const { error } = await supabase
          .from('portfolios')
          .update({ name: name.trim(), description: description.trim() || null })
          .eq('id', editPortfolio.id);

        if (error) throw error;
        toast.success('Portfolio updated');
      } else {
        const { error } = await supabase
          .from('portfolios')
          .insert({
            user_id: user.id,
            name: name.trim(),
            description: description.trim() || null,
          });

        if (error) throw error;
        toast.success('Portfolio created');
      }

      setName('');
      setDescription('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving portfolio:', error);
      toast.error('Failed to save portfolio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editPortfolio ? 'Edit Portfolio' : 'Create Portfolio'}</DialogTitle>
            <DialogDescription>
              {editPortfolio 
                ? 'Update your portfolio details.'
                : 'Create a new portfolio to group your properties together.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Portfolio Name</Label>
              <Input
                id="name"
                placeholder="e.g., Brooklyn Properties"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g., All properties managed by XYZ Realty"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editPortfolio ? 'Save Changes' : 'Create Portfolio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

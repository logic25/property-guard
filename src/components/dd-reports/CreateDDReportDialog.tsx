import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Building2, User, FileText } from 'lucide-react';

interface CreateDDReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (report: any) => void;
}

const CreateDDReportDialog = ({ open, onOpenChange, onSuccess }: CreateDDReportDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [address, setAddress] = useState('');
  const [preparedFor, setPreparedFor] = useState('');
  const [preparedBy, setPreparedBy] = useState('');

  const createReport = useMutation({
    mutationFn: async () => {
      // First create the report record with today's date in local timezone
      const today = new Date();
      const reportDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const { data: report, error: insertError } = await supabase
        .from('dd_reports')
        .insert({
          user_id: user?.id,
          address: address.trim(),
          prepared_for: preparedFor.trim(),
          prepared_by: preparedBy.trim() || null,
          status: 'generating',
          report_date: reportDate,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger the edge function to generate the report
      const { data: genData, error: genError } = await supabase.functions.invoke('generate-dd-report', {
        body: { reportId: report.id, address: address.trim() }
      });

      if (genError) {
        // Update status to error
        await supabase
          .from('dd_reports')
          .update({ status: 'error' })
          .eq('id', report.id);
        throw genError;
      }

      // Fetch the updated report
      const { data: updatedReport, error: fetchError } = await supabase
        .from('dd_reports')
        .select('*')
        .eq('id', report.id)
        .single();

      if (fetchError) throw fetchError;
      return updatedReport;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['dd-reports'] });
      toast({ 
        title: "Report generated successfully",
        description: "Your due diligence report is ready to view.",
      });
      setAddress('');
      setPreparedFor('');
      setPreparedBy('');
      onSuccess(report);
    },
    onError: (error: any) => {
      console.error('Error creating report:', error);
      toast({ 
        title: "Failed to generate report",
        description: error.message || "Please check the address and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !preparedFor.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please enter an address and recipient name.",
        variant: "destructive",
      });
      return;
    }
    createReport.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate DD Report
          </DialogTitle>
          <DialogDescription>
            Enter a NYC property address to generate a comprehensive due diligence report with violations, applications, and compliance data.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Property Address *
            </Label>
            <Input
              id="address"
              placeholder="e.g., 123 Main Street, Brooklyn, NY"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={createReport.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Enter a complete NYC address including borough
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preparedFor" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Prepared For *
            </Label>
            <Input
              id="preparedFor"
              placeholder="e.g., ABC Investors LLC"
              value={preparedFor}
              onChange={(e) => setPreparedFor(e.target.value)}
              disabled={createReport.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Name of the person or company this report is for
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preparedBy">Prepared By (Optional)</Label>
            <Input
              id="preparedBy"
              placeholder="Your name or company"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              disabled={createReport.isPending}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={createReport.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createReport.isPending}>
              {createReport.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDDReportDialog;

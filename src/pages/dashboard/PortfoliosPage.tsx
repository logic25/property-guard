import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PortfolioCard } from '@/components/portfolios/PortfolioCard';
import { CreatePortfolioDialog } from '@/components/portfolios/CreatePortfolioDialog';
import type { PortfolioWithStats } from '@/types/portfolio';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';

const PortfoliosPage = () => {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState<PortfolioWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editPortfolio, setEditPortfolio] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [deletePortfolioId, setDeletePortfolioId] = useState<string | null>(null);

  const fetchPortfolios = async () => {
    try {
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: false });

      if (portfolioError) throw portfolioError;

      // Get stats for each portfolio
      const portfoliosWithStats: PortfolioWithStats[] = await Promise.all(
        (portfolioData || []).map(async (portfolio) => {
          // Get properties in this portfolio
          const { data: properties } = await supabase
            .from('properties')
            .select('id')
            .eq('portfolio_id', portfolio.id);

          const propertyIds = properties?.map(p => p.id) || [];
          
          let totalViolations = 0;
          let openViolations = 0;
          let criticalViolations = 0;

          if (propertyIds.length > 0) {
            const { data: violations } = await supabase
              .from('violations')
              .select('status, is_stop_work_order, is_vacate_order')
              .in('property_id', propertyIds);

            totalViolations = violations?.length || 0;
            openViolations = violations?.filter(v => v.status === 'open').length || 0;
            criticalViolations = violations?.filter(v => v.is_stop_work_order || v.is_vacate_order).length || 0;
          }

          return {
            ...portfolio,
            property_count: propertyIds.length,
            total_violations: totalViolations,
            open_violations: openViolations,
            critical_violations: criticalViolations,
          };
        })
      );

      setPortfolios(portfoliosWithStats);
    } catch (error) {
      console.error('Error fetching portfolios:', error);
      toast.error('Failed to load portfolios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const handleDelete = async () => {
    if (!deletePortfolioId) return;

    try {
      // First unlink all properties from this portfolio
      await supabase
        .from('properties')
        .update({ portfolio_id: null })
        .eq('portfolio_id', deletePortfolioId);

      // Then delete the portfolio
      const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', deletePortfolioId);

      if (error) throw error;

      toast.success('Portfolio deleted');
      fetchPortfolios();
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      toast.error('Failed to delete portfolio');
    } finally {
      setDeletePortfolioId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Portfolios</h1>
          <p className="text-muted-foreground mt-1">
            Group properties together for combined violation tracking
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Portfolio
        </Button>
      </div>

      {/* Portfolio Grid */}
      {portfolios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              onClick={() => navigate(`/dashboard/portfolios/${portfolio.id}`)}
              onEdit={() => setEditPortfolio(portfolio)}
              onDelete={() => setDeletePortfolioId(portfolio.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">No portfolios yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create a portfolio to group multiple properties together and view combined violation reports.
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Portfolio
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CreatePortfolioDialog
        open={createDialogOpen || !!editPortfolio}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditPortfolio(null);
          }
        }}
        onSuccess={fetchPortfolios}
        editPortfolio={editPortfolio}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePortfolioId} onOpenChange={() => setDeletePortfolioId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portfolio?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the portfolio. Properties in this portfolio will be unlinked but not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortfoliosPage;

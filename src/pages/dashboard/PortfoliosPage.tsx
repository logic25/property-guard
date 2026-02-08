import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isActiveViolation } from '@/lib/violation-utils';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, MoreVertical, Pencil, Trash2, AlertTriangle, Building2 } from 'lucide-react';

const PortfoliosPage = () => {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState<PortfolioWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editPortfolio, setEditPortfolio] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [deletePortfolioId, setDeletePortfolioId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
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
              .select('status, oath_status, is_stop_work_order, is_vacate_order')
              .in('property_id', propertyIds);

            // Filter using proper resolved status check
            const activeViolations = (violations || []).filter(isActiveViolation);
            totalViolations = violations?.length || 0;
            openViolations = activeViolations.length;
            criticalViolations = activeViolations.filter(v => v.is_stop_work_order || v.is_vacate_order).length;
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

      {/* Portfolio Table */}
      {portfolios.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
                <TableHead className="font-semibold">Portfolio Name</TableHead>
                <TableHead className="font-semibold">Properties</TableHead>
                <TableHead className="font-semibold">Open Violations</TableHead>
                <TableHead className="font-semibold">Critical</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolios.map((portfolio) => (
                <Collapsible key={portfolio.id} asChild open={expandedRows.has(portfolio.id)} onOpenChange={() => toggleRow(portfolio.id)}>
                  <>
                    <TableRow 
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/dashboard/portfolios/${portfolio.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedRows.has(portfolio.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FolderOpen className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-medium">{portfolio.name}</span>
                            {portfolio.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{portfolio.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span>{portfolio.property_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {portfolio.open_violations > 0 ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                            {portfolio.open_violations}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {portfolio.critical_violations > 0 ? (
                          <div className="flex items-center gap-1 text-orange-600">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="font-medium">{portfolio.critical_violations}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditPortfolio(portfolio)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setDeletePortfolioId(portfolio.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr className="bg-muted/20">
                        <td colSpan={6} className="p-4 border-t border-border">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Description:</span>
                              <p className="font-medium">{portfolio.description || 'No description'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Violations:</span>
                              <p className="font-medium">{portfolio.total_violations}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <p className="font-medium">{new Date(portfolio.created_at).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/dashboard/portfolios/${portfolio.id}`)}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
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

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  AlertTriangle, 
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PortfolioWithStats } from '@/types/portfolio';

interface PortfolioCardProps {
  portfolio: PortfolioWithStats;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const PortfolioCard = ({ portfolio, onClick, onEdit, onDelete }: PortfolioCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={onClick}>
            <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
              {portfolio.name}
            </CardTitle>
            {portfolio.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {portfolio.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent onClick={onClick}>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{portfolio.property_count} Properties</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{portfolio.total_violations} Violations</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {portfolio.open_violations > 0 && (
              <Badge variant="destructive" className="text-xs">
                {portfolio.open_violations} Open
              </Badge>
            )}
            {portfolio.critical_violations > 0 && (
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 text-xs">
                {portfolio.critical_violations} Critical
              </Badge>
            )}
            {portfolio.open_violations === 0 && portfolio.critical_violations === 0 && (
              <Badge variant="secondary" className="text-xs">
                All Clear
              </Badge>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </CardContent>
    </Card>
  );
};

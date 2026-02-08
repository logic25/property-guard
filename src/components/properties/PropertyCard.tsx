import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, 
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { getBoroughName } from '@/lib/property-utils';

interface PropertyCardProps {
  property: {
    id: string;
    address: string;
    jurisdiction: 'NYC' | 'NON_NYC';
    stories: number | null;
    use_type: string | null;
    borough?: string | null;
    primary_use_group?: string | null;
    dwelling_units?: number | null;
    co_status?: string | null;
    applicable_agencies?: string[] | null;
    violations_count?: number;
  };
  onEdit?: (id: string) => void;
  onDelete: (id: string) => void;
}

export const PropertyCard = ({ property, onEdit, onDelete }: PropertyCardProps) => {
  const getCOStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case 'valid':
        return { icon: '🟢', label: 'Valid CO', className: 'bg-success/10 text-success' };
      case 'temporary':
        return { icon: '🟡', label: 'Temp CO', className: 'bg-warning/10 text-warning' };
      case 'expired_tco':
        return { icon: '🔴', label: 'Expired TCO', className: 'bg-destructive/10 text-destructive' };
      case 'missing':
        return { icon: '🔴', label: 'No CO', className: 'bg-destructive/10 text-destructive' };
      case 'pre_1938':
        return { icon: '🏛️', label: 'Pre-1938', className: 'bg-muted text-muted-foreground' };
      case 'use_violation':
        return { icon: '🟡', label: 'Use Violation', className: 'bg-warning/10 text-warning' };
      default:
        return { icon: '❔', label: 'Unknown', className: 'bg-muted text-muted-foreground' };
    }
  };

  const coStatus = getCOStatusDisplay(property.co_status);

  const getPropertyTypeDisplay = () => {
    const useGroup = property.primary_use_group || '';
    const units = property.dwelling_units;
    
    if (useGroup.includes('R-2') || useGroup.includes('R-1')) {
      return `${useGroup}${units ? ` (${units} units)` : ''}`;
    }
    if (useGroup.includes('M') || useGroup.includes('B')) {
      return `${useGroup} (Commercial)`;
    }
    if (property.use_type) {
      return property.use_type;
    }
    return useGroup || 'Unknown';
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          {/* CO Status Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${coStatus.className}`}>
            <span>{coStatus.icon}</span>
            {coStatus.label}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(property.id)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => onDelete(property.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="font-display font-semibold text-foreground mb-1 line-clamp-2">
        {property.address}
      </h3>
      
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`
          px-2 py-0.5 rounded text-xs font-medium
          ${property.jurisdiction === 'NYC' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}
        `}>
          {property.jurisdiction}
        </span>
        {property.borough && (
          <span className="text-xs text-muted-foreground">
            {getBoroughName(property.borough)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {getPropertyTypeDisplay()}
        </span>
      </div>

      {/* Agencies Tracked */}
      {property.applicable_agencies && property.applicable_agencies.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {property.applicable_agencies.map((agency) => (
            <Badge key={agency} variant="outline" className="text-[10px] px-1.5 py-0">
              {agency}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {property.stories ? `${property.stories} stories` : 'N/A'}
          </span>
        </div>
        {property.violations_count && property.violations_count > 0 ? (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            {property.violations_count} violation{property.violations_count > 1 ? 's' : ''}
          </div>
        ) : (
          <span className="text-xs text-success font-medium">Compliant</span>
        )}
      </div>
    </div>
  );
};

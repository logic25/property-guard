import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NYCBuildingData {
  bin_: string;
  house_: string;
  street_name: string;
  borough: string;
  block: string;
  lot: string;
  existingstories: string;
  existingheight: string;
  existingzoningsqft: string;
  existing_occupancy: string;
  existingdwellingunits: string;
}

interface AutocompleteResult {
  bin: string;
  address: string;
  borough: string;
  bbl: string;
  stories: number | null;
  heightFt: number | null;
  grossSqft: number | null;
  primaryUseGroup: string | null;
  dwellingUnits: number | null;
}

interface NYCAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AutocompleteResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const NYCAddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address...",
  disabled = false,
}: NYCAddressAutocompleteProps) => {
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchNYCBuildings = async (query: string) => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      // Parse query into house number and street
      const parts = query.trim().split(/\s+/);
      const houseNumber = parts[0];
      const streetQuery = parts.slice(1).join(' ').toUpperCase();

      // Search NYC DOB Buildings dataset
      const url = new URL('https://data.cityofnewyork.us/resource/ic3t-wcy2.json');
      
      if (streetQuery) {
        url.searchParams.set('$where', `house_ LIKE '%${houseNumber}%' AND upper(street_name) LIKE '%${streetQuery}%'`);
      } else {
        url.searchParams.set('$where', `house_ LIKE '%${houseNumber}%'`);
      }
      url.searchParams.set('$limit', '10');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error('Failed to search NYC buildings');
      }

      const data: NYCBuildingData[] = await response.json();

      const formattedResults: AutocompleteResult[] = data.map(building => ({
        bin: building.bin_ || '',
        address: `${building.house_} ${building.street_name}`.trim(),
        borough: building.borough || '',
        bbl: building.block && building.lot ? `${building.borough || ''}${building.block.padStart(5, '0')}${building.lot.padStart(4, '0')}` : '',
        stories: building.existingstories ? parseInt(building.existingstories) : null,
        heightFt: building.existingheight ? parseFloat(building.existingheight) : null,
        grossSqft: building.existingzoningsqft ? parseFloat(building.existingzoningsqft) : null,
        primaryUseGroup: building.existing_occupancy || null,
        dwellingUnits: building.existingdwellingunits ? parseInt(building.existingdwellingunits) : null,
      }));

      setResults(formattedResults);
      setShowDropdown(formattedResults.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Error searching NYC buildings:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchNYCBuildings(value);
      }, 300);
    } else {
      setResults([]);
      setShowDropdown(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  const handleSelect = (result: AutocompleteResult) => {
    onChange(result.address);
    onSelect(result);
    setShowDropdown(false);
    setResults([]);
  };

  const getBoroughName = (code: string) => {
    const boroughs: Record<string, string> = {
      '1': 'Manhattan',
      '2': 'Bronx',
      '3': 'Brooklyn',
      '4': 'Queens',
      '5': 'Staten Island',
      'MANHATTAN': 'Manhattan',
      'BRONX': 'Bronx',
      'BROOKLYN': 'Brooklyn',
      'QUEENS': 'Queens',
      'STATEN ISLAND': 'Staten Island',
    };
    return boroughs[code?.toUpperCase()] || code;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.bin}-${index}`}
              type="button"
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-start gap-3",
                index === selectedIndex && "bg-accent",
                index !== results.length - 1 && "border-b border-border"
              )}
              onClick={() => handleSelect(result)}
            >
              <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground text-sm">
                  {result.address}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                  <span>{getBoroughName(result.borough)}</span>
                  {result.bin && <span>BIN: {result.bin}</span>}
                  {result.stories && <span>{result.stories} stories</span>}
                  {result.dwellingUnits && <span>{result.dwellingUnits} units</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {value.length >= 3 && !isSearching && results.length === 0 && showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
          No NYC buildings found. You can enter the address manually.
        </div>
      )}
    </div>
  );
};

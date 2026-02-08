import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Building2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBoroughCode, getBoroughName } from '@/lib/property-utils';

// Google Maps API key - set in .env as VITE_GOOGLE_MAPS_API_KEY
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface NYCBuildingData {
  bin__: string;
  house__: string;
  street_name: string;
  borough: string;
  block: string;
  lot: string;
  existingno_of_stories: string;
  existing_height: string;
  existing_zoning_sqft: string;
  existing_occupancy: string;
  existing_dwelling_units: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AutocompleteResult {
  bin: string;
  address: string;
  borough: string;
  bbl: string;
  block: string;
  lot: string;
  stories: number | null;
  heightFt: number | null;
  grossSqft: number | null;
  primaryUseGroup: string | null;
  dwellingUnits: number | null;
}

interface SmartAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AutocompleteResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SmartAddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing a NYC address...",
  disabled = false,
}: SmartAddressAutocompleteProps) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [nycResults, setNycResults] = useState<AutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Load Google Maps API if key is available
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;

    if (window.google?.maps?.places) {
      setUseGoogleMaps(true);
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setUseGoogleMaps(true);
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
    };
    document.head.appendChild(script);
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search NYC DOB buildings database
  const searchNYCBuildings = async (query: string): Promise<AutocompleteResult[]> => {
    if (query.length < 3) return [];

    try {
      const parts = query.trim().split(/\s+/);
      const houseNumber = parts[0];
      const streetQuery = parts.slice(1).join(' ').toUpperCase();

      const url = new URL('https://data.cityofnewyork.us/resource/ic3t-wcy2.json');

      if (streetQuery) {
        url.searchParams.set('$where', `house__ LIKE '%${houseNumber}%' AND upper(street_name) LIKE '%${streetQuery}%'`);
      } else {
        url.searchParams.set('$where', `house__ LIKE '%${houseNumber}%'`);
      }
      url.searchParams.set('$limit', '25'); // Fetch more to dedupe

      const response = await fetch(url.toString());
      
      if (!response.ok) throw new Error('Failed to search NYC buildings');

      const data: NYCBuildingData[] = await response.json();

      // Deduplicate by BIN - keep only one result per unique building
      const seenBins = new Set<string>();
      const uniqueBuildings = data.filter(building => {
        const bin = building.bin__ || '';
        if (!bin || seenBins.has(bin)) return false;
        seenBins.add(bin);
        return true;
      });

      return uniqueBuildings.slice(0, 10).map(building => {
        const boroughCode = getBoroughCode(building.borough || '');
        const block = building.block || '';
        const lot = building.lot || '';
        const bbl = block && lot 
          ? `${boroughCode}${block.padStart(5, '0')}${lot.padStart(4, '0')}` 
          : '';
        
        return {
          bin: building.bin__ || '',
          address: `${building.house__} ${building.street_name}`.trim(),
          borough: boroughCode,
          bbl,
          block,
          lot,
          stories: building.existingno_of_stories ? parseInt(building.existingno_of_stories) : null,
          heightFt: building.existing_height ? parseFloat(building.existing_height) : null,
          grossSqft: building.existing_zoning_sqft ? parseFloat(building.existing_zoning_sqft) : null,
          primaryUseGroup: building.existing_occupancy || null,
          dwellingUnits: building.existing_dwelling_units ? parseInt(building.existing_dwelling_units) : null,
        };
      });
    } catch (error) {
      console.error('Error searching NYC buildings:', error);
      return [];
    }
  };

  // Fetch Google Places predictions
  const fetchGooglePredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || input.length < 3) {
      setPredictions([]);
      return;
    }

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'us' },
        types: ['address'],
      },
      (results, status) => {
        setIsSearching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          // Prefer NYC addresses
          const nycPredictions = results.filter(p =>
            p.description.includes('New York') ||
            p.description.includes('NY') ||
            p.description.includes('Brooklyn') ||
            p.description.includes('Queens') ||
            p.description.includes('Bronx') ||
            p.description.includes('Staten Island')
          );
          setPredictions(nycPredictions.length > 0 ? nycPredictions : results);
          setShowDropdown(true);
        } else {
          setPredictions([]);
        }
      }
    );
  }, []);

  // Fallback to NYC search
  const searchFallback = useCallback(async (input: string) => {
    setIsSearching(true);
    const results = await searchNYCBuildings(input);
    setNycResults(results);
    setShowDropdown(results.length > 0);
    setIsSearching(false);
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (newValue.length >= 3) {
        setIsSearching(true);
        if (useGoogleMaps) {
          fetchGooglePredictions(newValue);
        } else {
          searchFallback(newValue);
        }
      } else {
        setPredictions([]);
        setNycResults([]);
        setShowDropdown(false);
      }
    }, 300);
  };

  // Handle Google Place selection - sync with NYC data
  const handleGooglePlaceSelect = async (prediction: PlacePrediction) => {
    if (!placesServiceRef.current) return;

    setShowDropdown(false);
    setIsSyncing(true);

    // Get place details from Google
    placesServiceRef.current.getDetails(
      { placeId: prediction.place_id, fields: ['formatted_address', 'geometry', 'address_components'] },
      async (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          setIsSyncing(false);
          return;
        }

        const address = place.formatted_address || prediction.description;
        onChange(address);

        // Extract house number and street for NYC lookup
        let houseNumber = '';
        let streetName = '';
        let borough = '';

        place.address_components?.forEach(component => {
          if (component.types.includes('street_number')) {
            houseNumber = component.short_name;
          }
          if (component.types.includes('route')) {
            streetName = component.short_name;
          }
          if (component.types.includes('sublocality_level_1') || component.types.includes('locality')) {
            const boroughMap: Record<string, string> = {
              'Manhattan': '1', 'New York': '1', 'Bronx': '2', 
              'Brooklyn': '3', 'Queens': '4', 'Staten Island': '5'
            };
            borough = boroughMap[component.long_name] || '';
          }
        });

        // Sync with NYC DOB data
        if (houseNumber && streetName) {
          const nycResults = await searchNYCBuildings(`${houseNumber} ${streetName}`);
          
          if (nycResults.length > 0) {
            // Use the first match from NYC data
            const match = nycResults[0];
            setIsSyncing(false);
            onSelect(match);
            return;
          }
        }

        // Fallback if no NYC data found
        setIsSyncing(false);
        onSelect({
          bin: '',
          address,
          borough,
          bbl: '',
          block: '',
          lot: '',
          stories: null,
          heightFt: null,
          grossSqft: null,
          primaryUseGroup: null,
          dwellingUnits: null,
        });
      }
    );
  };

  // Handle NYC result selection
  const handleNYCSelect = (result: AutocompleteResult) => {
    onChange(result.address);
    onSelect(result);
    setShowDropdown(false);
    setNycResults([]);
    setPredictions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = useGoogleMaps ? predictions : nycResults;
    if (!showDropdown || items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (useGoogleMaps && predictions[selectedIndex]) {
            handleGooglePlaceSelect(predictions[selectedIndex]);
          } else if (nycResults[selectedIndex]) {
            handleNYCSelect(nycResults[selectedIndex]);
          }
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => (predictions.length > 0 || nycResults.length > 0) && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled || isSyncing}
          className="pl-10 pr-10"
        />
        {(isSearching || isSyncing) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Google Places dropdown */}
      {showDropdown && useGoogleMaps && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-start gap-3",
                index === selectedIndex && "bg-accent",
                index !== predictions.length - 1 && "border-b border-border"
              )}
              onClick={() => handleGooglePlaceSelect(prediction)}
            >
              <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground text-sm">
                  {prediction.structured_formatting.main_text}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {prediction.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/50 flex items-center gap-1">
            <Check className="w-3 h-3" />
            NYC building data will be synced on selection
          </div>
        </div>
      )}

      {/* NYC DOB fallback dropdown */}
      {showDropdown && !useGoogleMaps && nycResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {nycResults.map((result, index) => (
            <button
              key={`${result.bin}-${index}`}
              type="button"
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-start gap-3",
                index === selectedIndex && "bg-accent",
                index !== nycResults.length - 1 && "border-b border-border"
              )}
              onClick={() => handleNYCSelect(result)}
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
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Syncing indicator */}
      {isSyncing && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">
            Syncing building data from NYC DOB...
          </div>
        </div>
      )}

      {/* No results message */}
      {value.length >= 3 && !isSearching && !isSyncing && 
       predictions.length === 0 && nycResults.length === 0 && showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
          No addresses found. You can enter the address manually.
        </div>
      )}
    </div>
  );
};

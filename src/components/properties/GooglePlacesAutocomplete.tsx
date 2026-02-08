import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin } from 'lucide-react';

// Google Maps API key - restricted to your domain for security
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: {
    address: string;
    placeId: string;
    lat?: number;
    lng?: number;
    borough?: string;
    zipCode?: string;
  }) => void;
  placeholder?: string;
  className?: string;
}

export const GooglePlacesAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className,
}: GooglePlacesAutocompleteProps) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Maps API
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured');
      return;
    }

    if (window.google?.maps?.places) {
      setIsApiLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsApiLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup not needed as script stays loaded
    };
  }, []);

  // Initialize services when API is loaded
  useEffect(() => {
    if (isApiLoaded && window.google?.maps?.places) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      // Create a dummy div for PlacesService
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
    }
  }, [isApiLoaded]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || input.length < 3) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'us' },
        types: ['address'],
      },
      (results, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          // Filter for NYC addresses
          const nycPredictions = results.filter(
            (p) =>
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  const handleSelectPrediction = (prediction: PlacePrediction) => {
    if (!placesServiceRef.current) return;

    setIsLoading(true);
    setShowDropdown(false);

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry', 'address_components'],
      },
      (place, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const address = place.formatted_address || prediction.description;
          onChange(address);

          // Extract borough and zip from address components
          let borough = '';
          let zipCode = '';

          place.address_components?.forEach((component) => {
            if (component.types.includes('sublocality_level_1') || 
                component.types.includes('locality')) {
              // Map NYC borough names to codes
              const boroughMap: Record<string, string> = {
                'Manhattan': '1',
                'New York': '1',
                'Bronx': '2',
                'Brooklyn': '3',
                'Queens': '4',
                'Staten Island': '5',
              };
              borough = boroughMap[component.long_name] || '';
            }
            if (component.types.includes('postal_code')) {
              zipCode = component.short_name;
            }
          });

          onSelect({
            address,
            placeId: prediction.place_id,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng(),
            borough,
            zipCode,
          });
        }
      }
    );
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
        <p className="text-xs text-muted-foreground">
          Add VITE_GOOGLE_MAPS_API_KEY to enable address autocomplete
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className={`pl-10 ${className || ''}`}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
              onClick={() => handleSelectPrediction(prediction)}
            >
              <p className="text-sm font-medium text-foreground">
                {prediction.structured_formatting.main_text}
              </p>
              <p className="text-xs text-muted-foreground">
                {prediction.structured_formatting.secondary_text}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

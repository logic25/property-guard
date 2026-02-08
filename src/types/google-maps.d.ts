// Google Maps Places API type declarations
declare namespace google.maps.places {
  class AutocompleteService {
    getPlacePredictions(
      request: AutocompletionRequest,
      callback: (
        predictions: AutocompletePrediction[] | null,
        status: PlacesServiceStatus
      ) => void
    ): void;
  }

  class PlacesService {
    constructor(attrContainer: HTMLElement);
    getDetails(
      request: PlaceDetailsRequest,
      callback: (
        place: PlaceResult | null,
        status: PlacesServiceStatus
      ) => void
    ): void;
  }

  interface AutocompletionRequest {
    input: string;
    componentRestrictions?: { country: string | string[] };
    types?: string[];
  }

  interface AutocompletePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
  }

  interface PlaceDetailsRequest {
    placeId: string;
    fields?: string[];
  }

  interface PlaceResult {
    formatted_address?: string;
    geometry?: {
      location?: {
        lat(): number;
        lng(): number;
      };
    };
    address_components?: AddressComponent[];
  }

  interface AddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }

  enum PlacesServiceStatus {
    OK = 'OK',
    ZERO_RESULTS = 'ZERO_RESULTS',
    INVALID_REQUEST = 'INVALID_REQUEST',
    OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
    REQUEST_DENIED = 'REQUEST_DENIED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  }
}

interface Window {
  google?: {
    maps?: {
      places?: typeof google.maps.places;
    };
  };
}

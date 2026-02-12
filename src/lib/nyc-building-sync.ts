// NYC Building Data Sync Service
// Fetches comprehensive building data from PLUTO and BIS datasets
import { loggedFetch } from '@/lib/api-logger';

export interface NYCBuildingData {
  // Basic identifiers
  bin: string;
  bbl: string;
  borough: string;
  block: string;
  lot: string;
  address: string;

  // Building dimensions
  stories: number | null;
  heightFt: number | null;
  grossSqft: number | null;
  dwellingUnits: number | null;
  lotAreaSqft: number | null;
  buildingAreaSqft: number | null;
  residentialAreaSqft: number | null;
  commercialAreaSqft: number | null;
  officeAreaSqft: number | null;
  retailAreaSqft: number | null;
  garageAreaSqft: number | null;
  factoryAreaSqft: number | null;
  storageAreaSqft: number | null;
  otherAreaSqft: number | null;

  // Zoning
  zoningDistrict: string | null;
  zoningMap: string | null;
  overlayDistrict: string | null;
  specialDistrict: string | null;
  commercialOverlay: string | null;
  floorAreaRatio: number | null;
  maxFloorAreaRatio: number | null;
  airRightsSqft: number | null;
  unusedFar: number | null;

  // Building classification
  buildingClass: string | null;
  occupancyGroup: string | null;
  occupancyClassification: string | null;
  yearBuilt: number | null;
  yearAltered1: number | null;
  yearAltered2: number | null;

  // Location
  crossStreets: string | null;
  specialPlaceName: string | null;
  buildingRemarks: string | null;
  latitude: number | null;
  longitude: number | null;
  communityBoard: string | null;
  councilDistrict: string | null;
  censusTract: string | null;
  ntaName: string | null;

  // Landmark & special status
  isLandmark: boolean;
  landmarkStatus: string | null;
  specialStatus: string | null;
  historicDistrict: string | null;

  // Regulatory restrictions
  localLaw: string | null;
  loftLaw: boolean;
  sroRestricted: boolean;
  taRestricted: boolean;
  ubRestricted: boolean;
  environmentalRestrictions: string | null;
  grandfatheredSign: boolean;
  legalAdultUse: boolean;
  isCityOwned: boolean;
  professionalCertRestricted: boolean;

  // Additional info
  additionalBins: string[];
  hpdMultipleDwelling: boolean;
  numberOfBuildings: number | null;
  numberOfFloors: number | null;
  basementCode: string | null;
  assessedLandValue: number | null;
  assessedTotalValue: number | null;
  exemptLandValue: number | null;
  exemptTotalValue: number | null;
}

// PLUTO dataset - Primary Land Use Tax Lot Output (same as ZoLa uses)
const PLUTO_API = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';

// DOB Job Application Filings (for building info)
const DOB_JOBS_API = 'https://data.cityofnewyork.us/resource/ic3t-wcy2.json';

// NYC Property Address Directory (PAD) - authoritative for BIN/BBL lookups
const PAD_API = 'https://data.cityofnewyork.us/resource/bc8t-ecyu.json';

// NYC Geoclient API for cross streets (requires BBL)
const GEOCLIENT_PLACE_API = 'https://data.cityofnewyork.us/resource/ahrc-nbvq.json';

// PAD dataset is no longer accessible (403 Forbidden as of Feb 2026)
// BIN/BBL is now resolved from DOB Jobs + PLUTO directly
export async function fetchPADData(houseNumber: string, streetName: string, borough: string): Promise<{
  bin: string;
  bbl: string;
} | null> {
  console.warn('PAD dataset no longer accessible - using DOB Jobs fallback');
  return null;
}

// Fetch building data from DOB Jobs by BIN
async function fetchDOBJobsByBin(bin: string): Promise<Partial<NYCBuildingData> | null> {
  try {
    const url = new URL(DOB_JOBS_API);
    url.searchParams.set('bin__', bin);
    url.searchParams.set('$limit', '1');
    url.searchParams.set('$order', 'latest_action_date DESC');

    console.log('Fetching DOB Jobs data for BIN:', bin);
    const response = await loggedFetch(url.toString());
    if (!response.ok) {
      console.error('DOB Jobs API error:', response.status);
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      console.log('No DOB Jobs found for BIN:', bin);
      return null;
    }

    const d = results[0] as Record<string, any>;
    console.log('DOB Jobs data found:', d);

    return {
      stories: parseInt_(d.existingno_of_stories) || parseInt_(d.proposed_no_of_stories),
      heightFt: parseNumber(d.existing_height) || parseNumber(d.proposed_height),
      dwellingUnits: parseInt_(d.existing_dwelling_units) || parseInt_(d.proposed_dwelling_units),
      occupancyGroup: d.existing_occupancy || d.proposed_occupancy || null,
      occupancyClassification: d.proposed_occupancy || null,
      zoningDistrict: d.zoning_dist1 || null,
      buildingClass: d.building_class || null,
      latitude: parseNumber(d.gis_latitude),
      longitude: parseNumber(d.gis_longitude),
      councilDistrict: d.gis_council_district || null,
      censusTract: d.gis_census_tract || null,
      ntaName: d.gis_nta_name || null,
      communityBoard: d.community___board || null,
      isLandmark: parseYesNo(d.landmarked),
      loftLaw: parseYesNo(d.loft_board),
      isCityOwned: false,
      legalAdultUse: parseYesNo(d.adult_estab),
    };
  } catch (error) {
    console.error('Error fetching DOB Jobs data:', error);
    return null;
  }
}

// Helper to parse yes/no strings to boolean
const parseYesNo = (value: string | undefined | null): boolean => {
  if (!value) return false;
  const v = value.toUpperCase().trim();
  return v === 'YES' || v === 'Y' || v === '1' || v === 'TRUE';
};

// Helper to parse numeric values
const parseNumber = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? null : num;
};

// Helper to parse integer values
const parseInt_ = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? Math.floor(value) : parseInt(value, 10);
  return isNaN(num) ? null : num;
};

// Fetch building data from PLUTO by BBL
// BBL format in PLUTO is numeric: e.g., 3036140041 (borough 3, block 03614, lot 0041)
export async function fetchPLUTOData(bbl: string): Promise<Partial<NYCBuildingData> | null> {
  try {
    // Clean BBL - remove any non-numeric characters
    const cleanBbl = bbl.replace(/\D/g, '');
    
    // PLUTO accepts BBL in different formats, try numeric first
    const url = new URL(PLUTO_API);
    url.searchParams.set('bbl', cleanBbl);
    url.searchParams.set('$limit', '1');

    console.log('Fetching PLUTO data for BBL:', cleanBbl);
    const response = await loggedFetch(url.toString());
    if (!response.ok) {
      console.error('PLUTO API error:', response.status);
      return null;
    }

    const results = await response.json();
    console.log('PLUTO results:', results);
    
    if (!Array.isArray(results) || results.length === 0) {
      console.log('No PLUTO results found for BBL:', cleanBbl);
      return null;
    }

    const p = results[0] as Record<string, any>;

    return {
      // Zoning
      zoningDistrict: p.zonedist1 || null,
      overlayDistrict: p.overlay1 || null,
      specialDistrict: p.spdist1 || null,
      commercialOverlay: p.ltdheight || null,
      lotAreaSqft: parseInt_(p.lotarea),
      buildingAreaSqft: parseInt_(p.bldgarea),
      residentialAreaSqft: parseInt_(p.resarea),
      commercialAreaSqft: parseInt_(p.comarea),
      officeAreaSqft: parseInt_(p.officearea),
      retailAreaSqft: parseInt_(p.retailarea),
      garageAreaSqft: parseInt_(p.garession),
      factoryAreaSqft: parseInt_(p.factryarea),
      storageAreaSqft: parseInt_(p.strgearea),
      otherAreaSqft: parseInt_(p.otherarea),
      floorAreaRatio: parseNumber(p.builtfar),
      maxFloorAreaRatio: parseNumber(p.residfar) || parseNumber(p.commfar),
      unusedFar: parseNumber(p.residfar) ? parseNumber(p.residfar)! - (parseNumber(p.builtfar) || 0) : null,

      // Building classification
      buildingClass: p.bldgclass || null,
      yearBuilt: parseInt_(p.yearbuilt),
      yearAltered1: parseInt_(p.yearalter1),
      yearAltered2: parseInt_(p.yearalter2),

      // Location
      latitude: parseNumber(p.latitude),
      longitude: parseNumber(p.longitude),
      communityBoard: p.cd || null,
      councilDistrict: p.council || null,
      censusTract: p.ct2010 || null,

      // Building dimensions from PLUTO
      stories: parseInt_(p.numfloors),
      dwellingUnits: parseInt_(p.unitsres),
      grossSqft: parseInt_(p.bldgarea),
      heightFt: parseInt_(p.heightroof),

      // Landmark & historic
      isLandmark: parseYesNo(p.landmark),
      historicDistrict: p.histdist || null,

      // Assessed values
      assessedLandValue: parseNumber(p.assessland),
      assessedTotalValue: parseNumber(p.assesstot),
      exemptLandValue: parseNumber(p.exempttot) ? parseNumber(p.exemptland) : null,
      exemptTotalValue: parseNumber(p.exempttot),

      // Building count
      numberOfBuildings: parseInt_(p.numbldgs),
      
      // Address info from PLUTO
      address: p.address ? `${p.address}`.trim() : null,
    };
  } catch (error) {
    console.error('Error fetching PLUTO data:', error);
    return null;
  }
}

// Cross streets lookup - PAD no longer accessible
export async function fetchCrossStreets(bin: string): Promise<string | null> {
  // PAD dataset returns 403 as of Feb 2026
  console.warn('Cross streets lookup unavailable - PAD dataset inaccessible');
  return null;
}

// Fetch building data from DOB by address
export async function fetchDOBData(
  houseNumber: string,
  streetName: string
): Promise<Partial<NYCBuildingData> | null> {
  try {
    const url = new URL(DOB_JOBS_API);
    url.searchParams.set(
      '$where',
      `house__ LIKE '%${houseNumber}%' AND upper(street_name) LIKE '%${streetName.toUpperCase()}%'`
    );
    url.searchParams.set('$limit', '1');
    url.searchParams.set('$order', 'latest_action_date DESC');

    const response = await loggedFetch(url.toString());
    if (!response.ok) return null;

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const d = results[0] as Record<string, any>;

    return {
      bin: d.bin__ || d.gis_bin || '',
      borough: d.borough || '',
      block: (d.block || '').toString().replace(/^0+/, '') || '',
      lot: (d.lot || '').toString().replace(/^0+/, '') || '',
      address: `${d.house__ || ''} ${d.street_name || ''}`.trim(),

      // Building dimensions
      stories: parseInt_(d.existingno_of_stories),
      heightFt: parseNumber(d.existing_height),
      dwellingUnits: parseInt_(d.existing_dwelling_units),
      grossSqft: parseInt_(d.existing_zoning_sqft),

      // Occupancy
      occupancyGroup: d.existing_occupancy || null,
      occupancyClassification: d.proposed_occupancy || null,

      // Features
      loftLaw: parseYesNo(d.loft_board),
      isCityOwned: parseYesNo(d.city_owned),
      isLandmark: parseYesNo(d.landmarked),
      legalAdultUse: parseYesNo(d.adult_estab),

      // Location
      latitude: parseNumber(d.gis_latitude),
      longitude: parseNumber(d.gis_longitude),
      councilDistrict: d.gis_council_district || null,
      censusTract: d.gis_census_tract || null,
      ntaName: d.gis_nta_name || null,
      communityBoard: d.community___board || null,
    };
  } catch (error) {
    console.error('Error fetching DOB data:', error);
    return null;
  }
}

// Sync using existing BIN and BBL (preferred method when we already have identifiers)
export async function syncNYCBuildingDataByIdentifiers(
  bin: string | null,
  bbl: string | null
): Promise<NYCBuildingData | null> {
  console.log('Syncing by identifiers - BIN:', bin, 'BBL:', bbl);
  
  // Fetch PLUTO data, DOB Jobs data, and cross streets in parallel
  const [plutoData, dobJobsData, crossStreets] = await Promise.all([
    bbl ? fetchPLUTOData(bbl) : Promise.resolve(null),
    bin ? fetchDOBJobsByBin(bin) : Promise.resolve(null),
    bin ? fetchCrossStreets(bin) : Promise.resolve(null),
  ]);
  
  console.log('PLUTO data result:', plutoData);
  console.log('DOB Jobs data result:', dobJobsData);
  console.log('Cross streets result:', crossStreets);

  // If neither PLUTO nor DOB Jobs returned data, we can't sync
  if (!plutoData && !dobJobsData) {
    console.error('No data found from PLUTO or DOB Jobs for BBL:', bbl, 'BIN:', bin);
    return null;
  }

  // Parse BBL to get borough, block, lot
  const cleanBbl = (bbl || '').replace(/\D/g, '');
  const borough = cleanBbl.length >= 1 ? cleanBbl.substring(0, 1) : '';
  const block = cleanBbl.length >= 6 ? cleanBbl.substring(1, 6).replace(/^0+/, '') || '0' : '';
  const lot = cleanBbl.length >= 10 ? cleanBbl.substring(6, 10).replace(/^0+/, '') || '0' : '';

  // Build result, merging PLUTO (preferred) with DOB Jobs as fallback
  const result: NYCBuildingData = {
    // Identifiers
    bin: bin || '',
    bbl: cleanBbl,
    borough,
    block,
    lot,
    address: (plutoData as any)?.address || '',

    // Dimensions - prefer PLUTO, fallback to DOB Jobs
    stories: plutoData?.stories ?? dobJobsData?.stories ?? null,
    heightFt: plutoData?.heightFt ?? dobJobsData?.heightFt ?? null,
    grossSqft: plutoData?.grossSqft ?? null,
    dwellingUnits: plutoData?.dwellingUnits ?? dobJobsData?.dwellingUnits ?? null,
    lotAreaSqft: plutoData?.lotAreaSqft ?? null,
    buildingAreaSqft: plutoData?.buildingAreaSqft ?? null,
    residentialAreaSqft: plutoData?.residentialAreaSqft ?? null,
    commercialAreaSqft: plutoData?.commercialAreaSqft ?? null,
    officeAreaSqft: plutoData?.officeAreaSqft ?? null,
    retailAreaSqft: plutoData?.retailAreaSqft ?? null,
    garageAreaSqft: plutoData?.garageAreaSqft ?? null,
    factoryAreaSqft: plutoData?.factoryAreaSqft ?? null,
    storageAreaSqft: plutoData?.storageAreaSqft ?? null,
    otherAreaSqft: plutoData?.otherAreaSqft ?? null,

    // Zoning - prefer PLUTO, fallback to DOB Jobs
    zoningDistrict: plutoData?.zoningDistrict ?? dobJobsData?.zoningDistrict ?? null,
    zoningMap: plutoData?.zoningMap ?? null,
    overlayDistrict: plutoData?.overlayDistrict ?? null,
    specialDistrict: plutoData?.specialDistrict ?? null,
    commercialOverlay: plutoData?.commercialOverlay ?? null,
    floorAreaRatio: plutoData?.floorAreaRatio ?? null,
    maxFloorAreaRatio: plutoData?.maxFloorAreaRatio ?? null,
    airRightsSqft: plutoData?.unusedFar && plutoData?.lotAreaSqft 
      ? Math.floor(plutoData.unusedFar * plutoData.lotAreaSqft) 
      : null,
    unusedFar: plutoData?.unusedFar ?? null,

    // Building classification - merge sources
    buildingClass: plutoData?.buildingClass ?? dobJobsData?.buildingClass ?? null,
    occupancyGroup: dobJobsData?.occupancyGroup ?? null,
    occupancyClassification: dobJobsData?.occupancyClassification ?? null,
    yearBuilt: plutoData?.yearBuilt ?? null,
    yearAltered1: plutoData?.yearAltered1 ?? null,
    yearAltered2: plutoData?.yearAltered2 ?? null,

    // Location - merge sources, preferring PLUTO
    crossStreets: crossStreets || null,
    specialPlaceName: null,
    buildingRemarks: null,
    latitude: plutoData?.latitude ?? dobJobsData?.latitude ?? null,
    longitude: plutoData?.longitude ?? dobJobsData?.longitude ?? null,
    communityBoard: plutoData?.communityBoard ?? dobJobsData?.communityBoard ?? null,
    councilDistrict: plutoData?.councilDistrict ?? dobJobsData?.councilDistrict ?? null,
    censusTract: plutoData?.censusTract ?? dobJobsData?.censusTract ?? null,
    ntaName: dobJobsData?.ntaName ?? null,

    // Landmark & special status
    isLandmark: plutoData?.isLandmark ?? dobJobsData?.isLandmark ?? false,
    landmarkStatus: (plutoData?.isLandmark || dobJobsData?.isLandmark) ? 'LANDMARK' : null,
    specialStatus: null,
    historicDistrict: plutoData?.historicDistrict ?? null,

    // Regulatory restrictions - use DOB Jobs data where available
    localLaw: null,
    loftLaw: dobJobsData?.loftLaw ?? false,
    sroRestricted: false,
    taRestricted: false,
    ubRestricted: false,
    environmentalRestrictions: null,
    grandfatheredSign: false,
    legalAdultUse: dobJobsData?.legalAdultUse ?? false,
    isCityOwned: dobJobsData?.isCityOwned ?? false,
    professionalCertRestricted: false,

    // Additional info
    additionalBins: [],
    hpdMultipleDwelling: false,
    numberOfBuildings: plutoData?.numberOfBuildings ?? 1,
    numberOfFloors: plutoData?.stories ?? dobJobsData?.stories ?? null,
    basementCode: null,
    assessedLandValue: plutoData?.assessedLandValue ?? null,
    assessedTotalValue: plutoData?.assessedTotalValue ?? null,
    exemptLandValue: plutoData?.exemptLandValue ?? null,
    exemptTotalValue: plutoData?.exemptTotalValue ?? null,
  };

  return result;
}

// Main sync function - combines PLUTO and DOB data (fallback for address-based lookup)
export async function syncNYCBuildingData(address: string): Promise<NYCBuildingData | null> {
  // Parse address into house number and street
  const parts = address.split(',')[0].trim().split(/\s+/);
  const houseNumber = parts[0];
  const streetName = parts.slice(1).join(' ');

  if (!houseNumber || !streetName) {
    console.error('Invalid address format:', address);
    return null;
  }

  // First, get DOB data to get BIN and basic info
  const dobData = await fetchDOBData(houseNumber, streetName);

  if (!dobData || !dobData.bin) {
    console.error('No DOB data found for address:', address);
    return null;
  }

  // Build BBL from borough, block, lot
  const borough = dobData.borough || '';
  const block = (dobData.block || '').padStart(5, '0');
  const lot = (dobData.lot || '').padStart(4, '0');
  const bbl = borough && block && lot ? `${borough}${block}${lot}` : '';

  // Fetch PLUTO data if we have BBL
  let plutoData: Partial<NYCBuildingData> | null = null;
  if (bbl) {
    plutoData = await fetchPLUTOData(bbl);
  }

  // Merge data, preferring PLUTO for zoning/land data, DOB for building features
  const result: NYCBuildingData = {
    // Identifiers
    bin: dobData.bin || '',
    bbl,
    borough: dobData.borough || '',
    block: dobData.block || '',
    lot: dobData.lot || '',
    address: dobData.address || address,

    // Dimensions - prefer PLUTO, fallback to DOB
    stories: plutoData?.stories ?? dobData.stories ?? null,
    heightFt: dobData.heightFt ?? null,
    grossSqft: plutoData?.grossSqft ?? dobData.grossSqft ?? null,
    dwellingUnits: plutoData?.dwellingUnits ?? dobData.dwellingUnits ?? null,
    lotAreaSqft: plutoData?.lotAreaSqft ?? null,
    buildingAreaSqft: plutoData?.buildingAreaSqft ?? null,
    residentialAreaSqft: plutoData?.residentialAreaSqft ?? null,
    commercialAreaSqft: plutoData?.commercialAreaSqft ?? null,
    officeAreaSqft: plutoData?.officeAreaSqft ?? null,
    retailAreaSqft: plutoData?.retailAreaSqft ?? null,
    garageAreaSqft: plutoData?.garageAreaSqft ?? null,
    factoryAreaSqft: plutoData?.factoryAreaSqft ?? null,
    storageAreaSqft: plutoData?.storageAreaSqft ?? null,
    otherAreaSqft: plutoData?.otherAreaSqft ?? null,

    // Zoning from PLUTO
    zoningDistrict: plutoData?.zoningDistrict ?? null,
    zoningMap: plutoData?.zoningMap ?? null,
    overlayDistrict: plutoData?.overlayDistrict ?? null,
    specialDistrict: plutoData?.specialDistrict ?? null,
    commercialOverlay: plutoData?.commercialOverlay ?? null,
    floorAreaRatio: plutoData?.floorAreaRatio ?? null,
    maxFloorAreaRatio: plutoData?.maxFloorAreaRatio ?? null,
    airRightsSqft: plutoData?.unusedFar && plutoData?.lotAreaSqft 
      ? Math.floor(plutoData.unusedFar * plutoData.lotAreaSqft) 
      : null,
    unusedFar: plutoData?.unusedFar ?? null,

    // Building classification
    buildingClass: plutoData?.buildingClass ?? null,
    occupancyGroup: dobData.occupancyGroup ?? null,
    occupancyClassification: dobData.occupancyClassification ?? null,
    yearBuilt: plutoData?.yearBuilt ?? null,
    yearAltered1: plutoData?.yearAltered1 ?? null,
    yearAltered2: plutoData?.yearAltered2 ?? null,

    // Location
    crossStreets: null, // Would need geocoding or separate lookup
    specialPlaceName: null,
    buildingRemarks: null,
    latitude: plutoData?.latitude ?? dobData.latitude ?? null,
    longitude: plutoData?.longitude ?? dobData.longitude ?? null,
    communityBoard: plutoData?.communityBoard ?? dobData.communityBoard ?? null,
    councilDistrict: plutoData?.councilDistrict ?? dobData.councilDistrict ?? null,
    censusTract: plutoData?.censusTract ?? dobData.censusTract ?? null,
    ntaName: dobData.ntaName ?? null,

    // Landmark & special status
    isLandmark: plutoData?.isLandmark ?? dobData.isLandmark ?? false,
    landmarkStatus: plutoData?.isLandmark ? 'LANDMARK' : null,
    specialStatus: null,
    historicDistrict: plutoData?.historicDistrict ?? null,

    // Regulatory restrictions
    localLaw: null,
    loftLaw: dobData.loftLaw ?? false,
    sroRestricted: false,
    taRestricted: false,
    ubRestricted: false,
    environmentalRestrictions: null,
    grandfatheredSign: false,
    legalAdultUse: dobData.legalAdultUse ?? false,
    isCityOwned: dobData.isCityOwned ?? false,
    professionalCertRestricted: false,

    // Additional info
    additionalBins: [],
    hpdMultipleDwelling: false,
    numberOfBuildings: plutoData?.numberOfBuildings ?? 1,
    numberOfFloors: plutoData?.stories ?? dobData.stories ?? null,
    basementCode: null,
    assessedLandValue: plutoData?.assessedLandValue ?? null,
    assessedTotalValue: plutoData?.assessedTotalValue ?? null,
    exemptLandValue: plutoData?.exemptLandValue ?? null,
    exemptTotalValue: plutoData?.exemptTotalValue ?? null,
  };

  return result;
}

// Infer building features from characteristics when not explicitly set
export function inferBuildingFeatures(data: NYCBuildingData): {
  has_gas: boolean;
  has_boiler: boolean;
  has_elevator: boolean;
  has_sprinkler: boolean;
} {
  const stories = data.stories ?? 0;
  const dwellingUnits = data.dwellingUnits ?? 0;
  const grossSqft = data.grossSqft ?? 0;
  const buildingClass = (data.buildingClass || '').toUpperCase();
  const isResidential = dwellingUnits > 0 || buildingClass.startsWith('R') || buildingClass.startsWith('D') || buildingClass.startsWith('C');

  // Elevator: required in NYC for buildings 6+ stories (Multiple Dwelling Law §35)
  const has_elevator = stories >= 6;

  // Gas: virtually all residential buildings in NYC have gas service
  const has_gas = isResidential || dwellingUnits > 0 || grossSqft > 10000;

  // Boiler: standard for multi-unit residential, or any large building
  const has_boiler = dwellingUnits >= 6 || stories >= 3 || grossSqft > 25000;

  // Sprinkler: required in NYC for buildings 100+ ft or certain occupancies
  const has_sprinkler = stories >= 7 || grossSqft > 50000;

  return { has_gas, has_boiler, has_elevator, has_sprinkler };
}

// Convert sync result to database update format
export function toPropertyUpdate(data: NYCBuildingData): Record<string, any> {
  const inferredFeatures = inferBuildingFeatures(data);

  return {
    bin: data.bin || null,
    bbl: data.bbl || null,
    borough: data.borough || null,
    stories: data.stories,
    height_ft: data.heightFt,
    gross_sqft: data.grossSqft,
    dwelling_units: data.dwellingUnits,

    // Inferred building features
    has_gas: inferredFeatures.has_gas,
    has_boiler: inferredFeatures.has_boiler,
    has_elevator: inferredFeatures.has_elevator,
    has_sprinkler: inferredFeatures.has_sprinkler,
    
    // Zoning
    zoning_district: data.zoningDistrict,
    zoning_map: data.zoningMap,
    overlay_district: data.overlayDistrict,
    special_district: data.specialDistrict,
    commercial_overlay: data.commercialOverlay,
    lot_area_sqft: data.lotAreaSqft,
    building_area_sqft: data.buildingAreaSqft,
    residential_area_sqft: data.residentialAreaSqft,
    commercial_area_sqft: data.commercialAreaSqft,
    office_area_sqft: data.officeAreaSqft,
    retail_area_sqft: data.retailAreaSqft,
    garage_area_sqft: data.garageAreaSqft,
    factory_area_sqft: data.factoryAreaSqft,
    storage_area_sqft: data.storageAreaSqft,
    other_area_sqft: data.otherAreaSqft,
    floor_area_ratio: data.floorAreaRatio,
    max_floor_area_ratio: data.maxFloorAreaRatio,
    air_rights_sqft: data.airRightsSqft,
    unused_far: data.unusedFar,

    // Building classification
    building_class: data.buildingClass,
    occupancy_group: data.occupancyGroup,
    occupancy_classification: data.occupancyClassification,
    primary_use_group: data.occupancyGroup, // Map to existing field
    year_built: data.yearBuilt,
    year_altered_1: data.yearAltered1,
    year_altered_2: data.yearAltered2,

    // Location
    cross_streets: data.crossStreets,
    special_place_name: data.specialPlaceName,
    building_remarks: data.buildingRemarks,
    latitude: data.latitude,
    longitude: data.longitude,
    community_board: data.communityBoard,
    council_district: data.councilDistrict,
    census_tract: data.censusTract,
    nta_name: data.ntaName,

    // Landmark & special status
    is_landmark: data.isLandmark,
    landmark_status: data.landmarkStatus,
    special_status: data.specialStatus,
    historic_district: data.historicDistrict,

    // Regulatory restrictions
    local_law: data.localLaw,
    loft_law: data.loftLaw,
    sro_restricted: data.sroRestricted,
    ta_restricted: data.taRestricted,
    ub_restricted: data.ubRestricted,
    environmental_restrictions: data.environmentalRestrictions,
    grandfathered_sign: data.grandfatheredSign,
    legal_adult_use: data.legalAdultUse,
    is_city_owned: data.isCityOwned,
    professional_cert_restricted: data.professionalCertRestricted,

    // Additional info
    additional_bins: data.additionalBins.length > 0 ? data.additionalBins : null,
    hpd_multiple_dwelling: data.hpdMultipleDwelling,
    number_of_buildings: data.numberOfBuildings,
    number_of_floors: data.numberOfFloors,
    basement_code: data.basementCode,
    assessed_land_value: data.assessedLandValue,
    assessed_total_value: data.assessedTotalValue,
    exempt_land_value: data.exemptLandValue,
    exempt_total_value: data.exemptTotalValue,

    // Mark as synced
    last_synced_at: new Date().toISOString(),
  };
}

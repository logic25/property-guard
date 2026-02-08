-- Add comprehensive NYC building attributes to properties table

-- Zoning & Land Use
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS zoning_district text,
ADD COLUMN IF NOT EXISTS zoning_map text,
ADD COLUMN IF NOT EXISTS overlay_district text,
ADD COLUMN IF NOT EXISTS special_district text,
ADD COLUMN IF NOT EXISTS commercial_overlay text,
ADD COLUMN IF NOT EXISTS lot_area_sqft integer,
ADD COLUMN IF NOT EXISTS building_area_sqft integer,
ADD COLUMN IF NOT EXISTS residential_area_sqft integer,
ADD COLUMN IF NOT EXISTS commercial_area_sqft integer,
ADD COLUMN IF NOT EXISTS office_area_sqft integer,
ADD COLUMN IF NOT EXISTS retail_area_sqft integer,
ADD COLUMN IF NOT EXISTS garage_area_sqft integer,
ADD COLUMN IF NOT EXISTS factory_area_sqft integer,
ADD COLUMN IF NOT EXISTS storage_area_sqft integer,
ADD COLUMN IF NOT EXISTS other_area_sqft integer,
ADD COLUMN IF NOT EXISTS floor_area_ratio numeric(10,2),
ADD COLUMN IF NOT EXISTS max_floor_area_ratio numeric(10,2),
ADD COLUMN IF NOT EXISTS air_rights_sqft integer,
ADD COLUMN IF NOT EXISTS unused_far numeric(10,2);

-- Building Classification & Occupancy
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS building_class text,
ADD COLUMN IF NOT EXISTS occupancy_group text,
ADD COLUMN IF NOT EXISTS occupancy_classification text,
ADD COLUMN IF NOT EXISTS year_built integer,
ADD COLUMN IF NOT EXISTS year_altered_1 integer,
ADD COLUMN IF NOT EXISTS year_altered_2 integer;

-- Location Details
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS cross_streets text,
ADD COLUMN IF NOT EXISTS special_place_name text,
ADD COLUMN IF NOT EXISTS building_remarks text,
ADD COLUMN IF NOT EXISTS latitude numeric(12,8),
ADD COLUMN IF NOT EXISTS longitude numeric(12,8),
ADD COLUMN IF NOT EXISTS community_board text,
ADD COLUMN IF NOT EXISTS council_district text,
ADD COLUMN IF NOT EXISTS census_tract text,
ADD COLUMN IF NOT EXISTS nta_name text;

-- Landmark & Special Status
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS is_landmark boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS landmark_status text,
ADD COLUMN IF NOT EXISTS special_status text,
ADD COLUMN IF NOT EXISTS historic_district text;

-- Regulatory Restrictions
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS local_law text,
ADD COLUMN IF NOT EXISTS loft_law boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sro_restricted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ta_restricted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ub_restricted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS environmental_restrictions text,
ADD COLUMN IF NOT EXISTS grandfathered_sign boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS legal_adult_use boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_city_owned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS professional_cert_restricted boolean DEFAULT false;

-- Additional Building Info
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS additional_bins text[],
ADD COLUMN IF NOT EXISTS hpd_multiple_dwelling boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS number_of_buildings integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS number_of_floors integer,
ADD COLUMN IF NOT EXISTS basement_code text,
ADD COLUMN IF NOT EXISTS assessed_land_value numeric(15,2),
ADD COLUMN IF NOT EXISTS assessed_total_value numeric(15,2),
ADD COLUMN IF NOT EXISTS exempt_land_value numeric(15,2),
ADD COLUMN IF NOT EXISTS exempt_total_value numeric(15,2);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_properties_zoning ON public.properties(zoning_district);
CREATE INDEX IF NOT EXISTS idx_properties_landmark ON public.properties(is_landmark);
CREATE INDEX IF NOT EXISTS idx_properties_building_class ON public.properties(building_class);
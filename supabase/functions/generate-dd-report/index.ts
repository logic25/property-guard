// DD Report Generator v2 - Uses GeoSearch for address lookup
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// NYC Open Data endpoints - using reliable public APIs
const NYC_ENDPOINTS = {
  // PLUTO - Primary Land Use Tax Lot Output (most reliable for building data)
  PLUTO: "https://data.cityofnewyork.us/resource/64uk-42ks.json",
  // DOB BIS Jobs (reliable for BIN lookup by address)
  DOB_JOBS: "https://data.cityofnewyork.us/resource/ic3t-wcy2.json",
  // DOB Violations
  DOB_VIOLATIONS: "https://data.cityofnewyork.us/resource/3h2n-5cm9.json",
  // ECB Violations  
  ECB_VIOLATIONS: "https://data.cityofnewyork.us/resource/6bgk-3dad.json",
  // HPD Violations
  HPD_VIOLATIONS: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
  // DOB NOW Build Applications
  DOB_NOW: "https://data.cityofnewyork.us/resource/rbx6-tga4.json",
  // NYC GeoSearch (for address geocoding)
  GEOSEARCH: "https://geosearch.planninglabs.nyc/v2/search",
};

// Borough name to code mapping
const BOROUGH_CODES: Record<string, string> = {
  "MANHATTAN": "1", "MN": "1", "NEW YORK": "1",
  "BRONX": "2", "BX": "2", "THE BRONX": "2",
  "BROOKLYN": "3", "BK": "3", "KINGS": "3",
  "QUEENS": "4", "QN": "4",
  "STATEN ISLAND": "5", "SI": "5", "RICHMOND": "5",
};

async function fetchNYCData(endpoint: string, params: Record<string, string>): Promise<any[]> {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  try {
    console.log(`Fetching: ${url.toString()}`);
    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`NYC API error ${response.status}: ${errorText.substring(0, 200)}`);
      return [];
    }
    const data = await response.json();
    console.log(`Got ${Array.isArray(data) ? data.length : 'non-array'} results`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    return [];
  }
}

// Use NYC GeoSearch API to lookup property
async function geoSearchAddress(address: string): Promise<{ bin: string; bbl: string; label: string } | null> {
  try {
    const url = new URL(NYC_ENDPOINTS.GEOSEARCH);
    url.searchParams.set('text', address);
    
    console.log(`GeoSearch: ${url.toString()}`);
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`GeoSearch error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      console.log('No GeoSearch results');
      return null;
    }
    
    const feature = data.features[0];
    const props = feature.properties || {};
    
    console.log(`GeoSearch found: ${props.label}`);
    console.log(`Properties:`, JSON.stringify(props).substring(0, 500));
    
    // Extract BIN and BBL from pad_bin and pad_bbl fields
    const bin = props.pad_bin || props.addendum?.pad?.bin || '';
    const bbl = props.pad_bbl || props.addendum?.pad?.bbl || '';
    
    return {
      bin: bin.toString(),
      bbl: bbl.toString(),
      label: props.label || address,
    };
  } catch (error) {
    console.error('GeoSearch error:', error);
    return null;
  }
}

// Fallback: lookup BIN from DOB Jobs by address
async function lookupBINFromDOBJobs(houseNumber: string, streetName: string, borough: string): Promise<{ bin: string; bbl: string } | null> {
  // Clean street name
  const cleanStreet = streetName.toUpperCase()
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bPLACE\b/g, 'PL')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bROAD\b/g, 'RD')
    .trim();
  
  const results = await fetchNYCData(NYC_ENDPOINTS.DOB_JOBS, {
    "$where": `house__ LIKE '%${houseNumber}%' AND upper(street_name) LIKE '%${cleanStreet.split(' ')[0]}%' AND upper(borough) LIKE '%${borough}%'`,
    "$limit": "5",
    "$order": "latest_action_date DESC",
  });
  
  if (results.length > 0) {
    const r = results[0];
    const boroughCode = BOROUGH_CODES[borough.toUpperCase()] || '1';
    const block = (r.block || '').toString().padStart(5, '0');
    const lot = (r.lot || '').toString().padStart(4, '0');
    
    return {
      bin: r.bin__ || r.gis_bin || '',
      bbl: `${boroughCode}${block}${lot}`,
    };
  }
  
  return null;
}

// Parse address into components
function parseAddress(address: string): { houseNumber: string; streetName: string; borough: string; boroughCode: string } | null {
  const normalized = address.toUpperCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Try to extract borough from end
  let borough = "";
  let boroughCode = "";
  let addressWithoutBorough = normalized;
  
  for (const [name, code] of Object.entries(BOROUGH_CODES)) {
    if (normalized.includes(name)) {
      borough = name;
      boroughCode = code;
      addressWithoutBorough = normalized.replace(new RegExp(`\\s*${name}\\s*(NY)?\\s*(\\d{5})?\\s*$`, 'i'), '').trim();
      break;
    }
  }
  
  // Extract house number and street
  const match = addressWithoutBorough.match(/^(\d+[-\d]*)\s+(.+)$/);
  if (!match) {
    console.log("Could not parse address:", address);
    return null;
  }
  
  const [, houseNumber, streetName] = match;
  
  return { houseNumber, streetName: streetName.trim(), borough, boroughCode };
}

// Fetch building data from PLUTO
async function fetchPLUTOData(bbl: string): Promise<any> {
  const cleanBbl = bbl.replace(/\D/g, '');
  if (!cleanBbl || cleanBbl.length < 10) {
    console.log(`Invalid BBL: ${bbl}`);
    return null;
  }
  
  const results = await fetchNYCData(NYC_ENDPOINTS.PLUTO, {
    "bbl": cleanBbl,
    "$limit": "1",
  });
  
  if (results.length === 0) return null;
  
  const p = results[0];
  return {
    bin: p.bin || null,
    bbl: cleanBbl,
    address: p.address || null,
    borough: p.borough || null,
    year_built: p.yearbuilt ? parseInt(p.yearbuilt) : null,
    stories: p.numfloors ? parseInt(p.numfloors) : null,
    dwelling_units: p.unitsres ? parseInt(p.unitsres) : null,
    lot_area_sqft: p.lotarea ? parseInt(p.lotarea) : null,
    building_area_sqft: p.bldgarea ? parseInt(p.bldgarea) : null,
    zoning_district: p.zonedist1 || null,
    building_class: p.bldgclass || null,
    land_use: p.landuse || null,
    owner_name: p.ownername || null,
    assessed_total_value: p.assesstot ? parseFloat(p.assesstot) : null,
    is_landmark: p.landmark === 'Y',
    historic_district: p.histdist || null,
  };
}

// Fetch violations for property - only OPEN/ACTIVE violations
async function fetchViolations(bin: string, bbl: string): Promise<any[]> {
  const violations: any[] = [];
  
  // DOB Violations by BIN - filter for only ACTIVE violations (no disposition date)
  if (bin) {
    const dobViolations = await fetchNYCData(NYC_ENDPOINTS.DOB_VIOLATIONS, {
      "bin": bin,
      "$where": "disposition_date IS NULL",
      "$limit": "200",
      "$order": "issue_date DESC",
    });
    
    violations.push(...dobViolations.map((v: any) => ({
      id: v.isn_dob_bis_viol || v.number,
      agency: "DOB",
      violation_number: v.isn_dob_bis_viol || v.number,
      violation_type: v.violation_type || null,
      violation_class: v.violation_category || null,
      description_raw: v.description || v.violation_type_code || null,
      issued_date: v.issue_date || null,
      severity: v.violation_category || null,
      status: "open",
      is_stop_work_order: (v.violation_type || '').toLowerCase().includes('stop work'),
      is_partial_stop_work: (v.violation_type || '').toLowerCase().includes('partial stop work'),
      is_vacate_order: (v.violation_type || '').toLowerCase().includes('vacate'),
      disposition: v.disposition_comments || null,
    })));
  }
  
  // ECB Violations by BIN - only RESOLVE status = open
  if (bin) {
    const ecbViolations = await fetchNYCData(NYC_ENDPOINTS.ECB_VIOLATIONS, {
      "bin": bin,
      "$where": "ecb_violation_status != 'RESOLVE'",
      "$limit": "200",
      "$order": "issue_date DESC",
    });
    
    violations.push(...ecbViolations.map((v: any) => ({
      id: v.ecb_violation_number,
      agency: "ECB",
      violation_number: v.ecb_violation_number,
      violation_type: v.infraction_code1 || null,
      violation_class: v.violation_type || null,
      description_raw: v.violation_description || null,
      issued_date: v.issue_date || null,
      severity: v.severity || null,
      status: (v.ecb_violation_status || 'open').toLowerCase(),
      penalty_amount: v.penality_imposed ? parseFloat(v.penality_imposed) : null,
      hearing_date: v.hearing_date || null,
      scheduled_hearing_date: v.scheduled_hearing_date || null,
    })));
  }
  
  // HPD Violations by BBL components - only open status
  if (bbl && bbl.length >= 10) {
    const borough = bbl.slice(0, 1);
    const block = bbl.slice(1, 6).replace(/^0+/, '') || '0';
    const lot = bbl.slice(6, 10).replace(/^0+/, '') || '0';
    
    const hpdViolations = await fetchNYCData(NYC_ENDPOINTS.HPD_VIOLATIONS, {
      "boroid": borough,
      "block": block,
      "lot": lot,
      "$where": "violationstatus = 'Open'",
      "$limit": "200",
      "$order": "inspectiondate DESC",
    });
    
    violations.push(...hpdViolations.map((v: any) => ({
      id: v.violationid,
      agency: "HPD",
      violation_number: v.violationid?.toString() || null,
      violation_type: v.novdescription?.slice(0, 50) || null,
      violation_class: v.class || null,
      description_raw: v.novdescription || null,
      issued_date: v.inspectiondate || v.novissueddate || null,
      severity: v.class || null,
      status: "open",
      apartment: v.apartment || null,
      story: v.story || null,
    })));
  }
  
  return violations;
}

// Fetch applications/permits for property
async function fetchApplications(bin: string): Promise<any[]> {
  const applications: any[] = [];
  
  if (!bin) return applications;
  
  // DOB BIS Jobs - include more detail fields
  const dobJobs = await fetchNYCData(NYC_ENDPOINTS.DOB_JOBS, {
    "bin__": bin,
    "$limit": "100",
    "$order": "latest_action_date DESC",
  });
  
  applications.push(...dobJobs.map((j: any) => ({
    id: j.job__,
    source: "BIS",
    application_number: j.job__,
    application_type: j.job_type || null,
    job_type: j.job_doc_type || null,
    work_type: j.work_type || null,
    job_description: j.job_description || null,
    status: j.job_status || null,
    filing_date: j.pre__filing_date || j.filing_date || null,
    latest_action_date: j.latest_action_date || null,
    approval_date: j.approved_date || null,
    expiration_date: j.permit_expiration_date || null,
    estimated_cost: j.initial_cost ? parseFloat(j.initial_cost) : null,
    floor: j.bldg_floor || null,
    apartment: j.apt_condonos || null,
    owner_name: j.owner_s_first_name && j.owner_s_last_name 
      ? `${j.owner_s_first_name} ${j.owner_s_last_name}` 
      : j.owner_s_business_name || null,
    applicant_name: j.applicant_s_first_name && j.applicant_s_last_name
      ? `${j.applicant_s_first_name} ${j.applicant_s_last_name}`
      : null,
    fully_permitted: j.fully_permitted || null,
    signoff_date: j.signoff_date || null,
  })));
  
  // DOB NOW Applications - note: filing_date column doesn't exist, use job_filing_number order
  const dobNowApps = await fetchNYCData(NYC_ENDPOINTS.DOB_NOW, {
    "bin": bin,
    "$limit": "100",
  });
  
  applications.push(...dobNowApps.map((a: any) => ({
    id: a.job_filing_number || a.filing_number,
    source: "DOB_NOW",
    application_number: a.job_filing_number || a.filing_number,
    application_type: a.job_type || a.filing_type || null,
    work_type: a.work_type || null,
    job_description: a.job_description || a.work_on_floor || null,
    status: a.filing_status || a.current_status || null,
    filing_date: a.filing_date || null,
    latest_action_date: a.latest_action_date || null,
    estimated_cost: a.estimated_job_cost ? parseFloat(a.estimated_job_cost) : null,
    floor: a.work_on_floor || null,
    applicant_name: a.applicant_business_name || a.applicant_name || null,
  })));
  
  return applications;
}

// Generate AI analysis
async function generateAIAnalysis(reportData: any, LOVABLE_API_KEY: string): Promise<string> {
  const { building, violations, applications, orders } = reportData;
  
  const openViolations = violations.filter((v: any) => v.status === 'open');
  const dobViolations = openViolations.filter((v: any) => v.agency === 'DOB');
  const ecbViolations = openViolations.filter((v: any) => v.agency === 'ECB');
  const hpdViolations = openViolations.filter((v: any) => v.agency === 'HPD');
  
  const prompt = `You are a professional real estate due diligence analyst. Analyze this NYC property data and provide a comprehensive risk assessment.

PROPERTY SUMMARY:
- Address: ${building?.address || 'Unknown'}
- BIN: ${building?.bin || 'Unknown'}
- BBL: ${building?.bbl || 'Unknown'}
- Year Built: ${building?.year_built || 'Unknown'}
- Stories: ${building?.stories || 'Unknown'}
- Dwelling Units: ${building?.dwelling_units || 'Unknown'}
- Building Class: ${building?.building_class || 'Unknown'}
- Zoning: ${building?.zoning_district || 'Unknown'}
- Landmark: ${building?.is_landmark ? 'Yes' : 'No'}
- Owner: ${building?.owner_name || 'Unknown'}

VIOLATIONS SUMMARY:
- Total Open: ${openViolations.length}
- DOB Violations: ${dobViolations.length}
- ECB Violations: ${ecbViolations.length}
- HPD Violations: ${hpdViolations.length}
- Stop Work Orders: ${orders.stop_work?.length || 0}
- Vacate Orders: ${orders.vacate?.length || 0}

RECENT VIOLATIONS:
${openViolations.slice(0, 15).map((v: any) => `- [${v.agency}] ${v.violation_type || v.description_raw || 'Unknown'} (${v.issued_date || 'date unknown'})`).join('\n') || 'None found'}

PERMIT APPLICATIONS (${applications.length} total):
${applications.slice(0, 10).map((a: any) => `- [${a.source}] ${a.application_type || 'Unknown'} - Status: ${a.status || 'Unknown'} (Filed: ${a.filing_date || 'unknown'})`).join('\n') || 'None found'}

Please provide:
1. **Risk Level**: (Low / Medium / High / Critical) with justification
2. **Key Findings**: Top 3-5 concerns or notable items
3. **Violation Analysis**: Summary of violation patterns and severity
4. **Permit Activity**: Analysis of any active or recent permit work
5. **Recommendations**: Suggested next steps for due diligence

Format as a professional report suitable for investors or lenders.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional real estate due diligence analyst specializing in NYC properties. Provide clear, actionable analysis." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      return "AI analysis could not be generated. Please review the data manually.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "AI analysis unavailable.";
  } catch (error) {
    console.error("AI generation error:", error);
    return "AI analysis could not be generated due to an error.";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    // Validate the JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;
    console.log(`Authenticated user: ${userId}`);

    const { reportId, address } = await req.json();

    if (!reportId || !address) {
      return new Response(
        JSON.stringify({ error: "Missing reportId or address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`=== Generating DD report for: ${address} ===`);

    // Step 1: Try GeoSearch first (most reliable)
    let bin = '';
    let bbl = '';
    let resolvedAddress = address;
    
    const geoResult = await geoSearchAddress(address);
    if (geoResult) {
      bin = geoResult.bin;
      bbl = geoResult.bbl;
      resolvedAddress = geoResult.label;
      console.log(`GeoSearch success - BIN: ${bin}, BBL: ${bbl}`);
    } else {
      // Fallback: Parse address and try DOB Jobs
      console.log(`GeoSearch failed, trying DOB Jobs fallback`);
      const parsed = parseAddress(address);
      if (parsed) {
        const dobResult = await lookupBINFromDOBJobs(parsed.houseNumber, parsed.streetName, parsed.borough);
        if (dobResult) {
          bin = dobResult.bin;
          bbl = dobResult.bbl;
          console.log(`DOB Jobs lookup success - BIN: ${bin}, BBL: ${bbl}`);
        }
      }
    }

    // Step 2: Fetch PLUTO data
    let building: any = null;
    if (bbl) {
      building = await fetchPLUTOData(bbl);
      if (building) {
        if (!bin && building.bin) {
          bin = building.bin;
        }
        building.address = resolvedAddress;
        console.log(`PLUTO data fetched:`, JSON.stringify(building).substring(0, 300));
      }
    }

    if (!bin && !bbl) {
      console.log(`Could not resolve property: ${address}`);
      await supabase.from('dd_reports').update({ 
        status: 'error',
        ai_analysis: 'Could not find property in NYC databases. Please verify the address is correct and includes the borough (e.g., "123 Main St, Brooklyn, NY").'
      }).eq('id', reportId);
      
      return new Response(
        JSON.stringify({ error: "Property not found in NYC databases. Please check the address format." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Fetch violations
    console.log(`Fetching violations for BIN: ${bin}, BBL: ${bbl}`);
    const violations = await fetchViolations(bin, bbl);
    console.log(`Found ${violations.length} total violations`);

    // Step 4: Fetch applications
    console.log(`Fetching applications for BIN: ${bin}`);
    const applications = await fetchApplications(bin);
    console.log(`Found ${applications.length} applications`);

    // Step 5: Separate critical orders
    const orders = {
      stop_work: violations.filter(v => v.is_stop_work_order && !v.is_partial_stop_work),
      partial_stop_work: violations.filter(v => v.is_partial_stop_work),
      vacate: violations.filter(v => v.is_vacate_order),
    };
    console.log(`Stop Work Orders: ${orders.stop_work.length}, Partial SWO: ${orders.partial_stop_work.length}, Vacate Orders: ${orders.vacate.length}`);

    // All violations are already filtered to open status
    console.log(`Open violations: ${violations.length}`);

    // Step 6: Generate AI analysis
    console.log(`Generating AI analysis...`);
    const aiAnalysis = await generateAIAnalysis(
      { building: building || { address: resolvedAddress, bin, bbl }, violations, applications, orders },
      LOVABLE_API_KEY
    );
    console.log(`AI analysis generated (${aiAnalysis.length} chars)`);

    // Step 7: Update the report
    const { error: updateError } = await supabase
      .from('dd_reports')
      .update({
        bin: bin || null,
        bbl: bbl || null,
        building_data: building || { address: resolvedAddress, bin, bbl },
        violations_data: violations,
        applications_data: applications,
        orders_data: orders,
        ai_analysis: aiAnalysis,
        status: 'completed',
      })
      .eq('id', reportId);

    if (updateError) {
      console.error("Error updating report:", updateError);
      throw updateError;
    }

    console.log(`=== Report generated successfully ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bin, 
        bbl,
        violationsCount: violations.length,
        applicationsCount: applications.length,
        stopWorkOrders: orders.stop_work.length,
        partialStopWorkOrders: orders.partial_stop_work.length,
        vacateOrders: orders.vacate.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating DD report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

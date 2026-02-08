import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NYC Open Data endpoints
const NYC_DATA_ENDPOINTS = {
  // DOB BIS Jobs
  DOB_JOBS: "https://data.cityofnewyork.us/resource/ic3t-wcy2.json",
  // DOB Violations
  DOB_VIOLATIONS: "https://data.cityofnewyork.us/resource/3h2n-5cm9.json",
  // ECB Violations
  ECB_VIOLATIONS: "https://data.cityofnewyork.us/resource/6bgk-3dad.json",
  // HPD Violations
  HPD_VIOLATIONS: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
  // PLUTO (building data)
  PLUTO: "https://data.cityofnewyork.us/resource/64uk-42ks.json",
  // DOB NOW Build Applications
  DOB_NOW: "https://data.cityofnewyork.us/resource/rbx6-tga4.json",
};

async function fetchNYCData(endpoint: string, params: Record<string, string>) {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  try {
    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) {
      console.error(`NYC API error: ${response.status}`);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    return [];
  }
}

async function lookupBBLByAddress(address: string): Promise<{ bin?: string; bbl?: string; building?: any }> {
  // Try PLUTO lookup by address
  const normalizedAddress = address.toUpperCase().replace(/,/g, '').trim();
  
  // Extract house number and street
  const match = normalizedAddress.match(/^(\d+)\s+(.+?)(?:\s+(BROOKLYN|MANHATTAN|QUEENS|BRONX|STATEN ISLAND|NY|NEW YORK))?$/i);
  if (!match) {
    console.log("Could not parse address:", address);
    return {};
  }
  
  const [, houseNum, street] = match;
  
  // Query PLUTO
  const plutoData = await fetchNYCData(NYC_DATA_ENDPOINTS.PLUTO, {
    "$where": `upper(address) LIKE '%${street.split(' ')[0]}%'`,
    "$limit": "10",
  });
  
  if (plutoData.length > 0) {
    const building = plutoData[0];
    return {
      bin: building.bin,
      bbl: building.bbl,
      building: {
        bin: building.bin,
        bbl: building.bbl,
        address: building.address,
        borough: building.borough,
        year_built: building.yearbuilt,
        stories: building.numfloors,
        dwelling_units: building.unitsres,
        lot_area_sqft: building.lotarea,
        building_area_sqft: building.bldgarea,
        zoning_district: building.zonedist1,
        building_class: building.bldgclass,
        land_use: building.landuse,
        owner_name: building.ownername,
      }
    };
  }
  
  return {};
}

async function fetchViolationsForBIN(bin: string, bbl: string) {
  const violations: any[] = [];
  
  // DOB Violations
  if (bin) {
    const dobViolations = await fetchNYCData(NYC_DATA_ENDPOINTS.DOB_VIOLATIONS, {
      "bin": bin,
      "$limit": "100",
    });
    violations.push(...dobViolations.map((v: any) => ({
      ...v,
      agency: "DOB",
      violation_number: v.isn_dob_bis_viol || v.violation_number,
      issued_date: v.issue_date,
      severity: v.violation_category,
      status: v.disposition_date ? "closed" : "open",
      is_stop_work_order: v.violation_type?.toLowerCase().includes('stop work'),
      is_vacate_order: v.violation_type?.toLowerCase().includes('vacate'),
    })));
  }
  
  // ECB Violations
  if (bin) {
    const ecbViolations = await fetchNYCData(NYC_DATA_ENDPOINTS.ECB_VIOLATIONS, {
      "bin": bin,
      "$limit": "100",
    });
    violations.push(...ecbViolations.map((v: any) => ({
      ...v,
      agency: "ECB",
      violation_number: v.ecb_violation_number,
      issued_date: v.issue_date,
      severity: v.severity,
      status: v.ecb_violation_status?.toLowerCase() || "open",
      violation_type: v.violation_description,
    })));
  }
  
  // HPD Violations
  if (bbl) {
    const [borough, block, lot] = [bbl.slice(0, 1), bbl.slice(1, 6), bbl.slice(6)];
    const hpdViolations = await fetchNYCData(NYC_DATA_ENDPOINTS.HPD_VIOLATIONS, {
      "boroid": borough,
      "block": block.replace(/^0+/, ''),
      "lot": lot.replace(/^0+/, ''),
      "$limit": "100",
    });
    violations.push(...hpdViolations.map((v: any) => ({
      ...v,
      agency: "HPD",
      violation_number: v.violationid,
      issued_date: v.inspectiondate,
      severity: v.class,
      status: v.violationstatus?.toLowerCase() || "open",
      violation_type: v.novdescription,
    })));
  }
  
  return violations;
}

async function fetchApplicationsForBIN(bin: string) {
  const applications: any[] = [];
  
  // DOB BIS Jobs
  if (bin) {
    const dobJobs = await fetchNYCData(NYC_DATA_ENDPOINTS.DOB_JOBS, {
      "bin__": bin,
      "$limit": "100",
    });
    applications.push(...dobJobs.map((j: any) => ({
      ...j,
      source: "BIS",
      application_number: j.job__,
      application_type: j.job_type,
      status: j.job_status,
      filing_date: j.pre__filing_date || j.filing_date,
      estimated_cost: j.initial_cost,
      work_type: j.work_type,
    })));
  }
  
  // DOB NOW Applications
  if (bin) {
    const dobNowApps = await fetchNYCData(NYC_DATA_ENDPOINTS.DOB_NOW, {
      "bin": bin,
      "$limit": "100",
    });
    applications.push(...dobNowApps.map((a: any) => ({
      ...a,
      source: "DOB_NOW",
      application_number: a.job_filing_number || a.filing_number,
      application_type: a.job_type || a.filing_type,
      status: a.filing_status || a.current_status,
      filing_date: a.filing_date,
      estimated_cost: a.estimated_job_cost,
    })));
  }
  
  return applications;
}

async function generateAIAnalysis(reportData: any, LOVABLE_API_KEY: string): Promise<string> {
  const { building, violations, applications, orders } = reportData;
  
  const prompt = `You are a real estate due diligence analyst. Analyze the following NYC property data and provide a concise risk assessment.

BUILDING:
${JSON.stringify(building, null, 2)}

VIOLATIONS (${violations.length} total):
${violations.slice(0, 20).map((v: any) => `- ${v.agency}: ${v.violation_type || v.description_raw} (${v.status})`).join('\n')}

APPLICATIONS (${applications.length} total):
${applications.slice(0, 10).map((a: any) => `- ${a.source}: ${a.application_type} - ${a.status}`).join('\n')}

CRITICAL ORDERS:
- Stop Work Orders: ${orders.stop_work?.length || 0}
- Vacate Orders: ${orders.vacate?.length || 0}

Provide a brief analysis covering:
1. Overall Risk Assessment (Low/Medium/High)
2. Key Concerns
3. Notable Open Violations
4. Active Permits/Work
5. Recommendations

Keep it concise and professional, suitable for a due diligence report.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a professional real estate due diligence analyst." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error("AI API error:", response.status);
    return "AI analysis unavailable.";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "AI analysis unavailable.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, address } = await req.json();

    if (!reportId || !address) {
      return new Response(
        JSON.stringify({ error: "Missing reportId or address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Generating DD report for: ${address}`);

    // Step 1: Lookup building by address
    const { bin, bbl, building } = await lookupBBLByAddress(address);
    console.log(`Found BIN: ${bin}, BBL: ${bbl}`);

    // Step 2: Fetch violations
    const violations = await fetchViolationsForBIN(bin || '', bbl || '');
    console.log(`Found ${violations.length} violations`);

    // Step 3: Fetch applications
    const applications = await fetchApplicationsForBIN(bin || '');
    console.log(`Found ${applications.length} applications`);

    // Step 4: Separate critical orders
    const orders = {
      stop_work: violations.filter(v => v.is_stop_work_order),
      vacate: violations.filter(v => v.is_vacate_order),
    };

    // Filter open violations only
    const openViolations = violations.filter(v => v.status === 'open');

    // Step 5: Generate AI analysis
    const aiAnalysis = await generateAIAnalysis(
      { building, violations: openViolations, applications, orders },
      LOVABLE_API_KEY
    );

    // Step 6: Update the report
    const { error: updateError } = await supabase
      .from('dd_reports')
      .update({
        bin: bin || null,
        bbl: bbl || null,
        building_data: building || {},
        violations_data: openViolations,
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        bin, 
        bbl,
        violationsCount: openViolations.length,
        applicationsCount: applications.length,
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

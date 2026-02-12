/**
 * NYC Local Law Applicability Engine
 * Determines which Local Laws apply to a property based on its characteristics.
 */

export interface PropertyForCompliance {
  id: string;
  bbl?: string | null;
  stories?: number | null;
  gross_sqft?: number | null;
  building_area_sqft?: number | null;
  dwelling_units?: number | null;
  has_gas?: boolean | null;
  has_elevator?: boolean | null;
  has_boiler?: boolean | null;
  has_sprinkler?: boolean | null;
  building_class?: string | null;
  occupancy_group?: string | null;
  year_built?: number | null;
  height_ft?: number | null;
  is_landmark?: boolean | null;
  number_of_buildings?: number | null;
  primary_use_group?: string | null;
  use_type?: string | null;
}

export interface LocalLawRequirement {
  local_law: string;
  requirement_name: string;
  description: string;
  applies: boolean;
  applicability_reason: string;
  cycle_year: number | null;
  next_due_date: string | null;
  filing_deadline: string | null;
  penalty_amount: number | null;
  penalty_description: string | null;
  status: 'pending' | 'compliant' | 'overdue' | 'exempt' | 'due_soon';
  learn_more_url: string;
  tooltip: string;
}

// Helper: get block number from BBL (digits 2-6)
function getBlock(bbl: string | null | undefined): number | null {
  if (!bbl || bbl.length < 6) return null;
  return parseInt(bbl.substring(1, 6), 10);
}

// Helper: get last digit of block for cycle determination
function getBlockLastDigit(bbl: string | null | undefined): number | null {
  const block = getBlock(bbl);
  if (block === null) return null;
  return block % 10;
}

// Helper: effective sqft
function effectiveSqft(p: PropertyForCompliance): number {
  return p.building_area_sqft || p.gross_sqft || 0;
}

// Helper: is residential
function isResidential(p: PropertyForCompliance): boolean {
  const bc = p.building_class?.charAt(0)?.toUpperCase();
  if (bc && ['A', 'B', 'C', 'D', 'R', 'S'].includes(bc)) return true;
  if (p.dwelling_units && p.dwelling_units > 0) return true;
  const use = (p.use_type || p.primary_use_group || '').toLowerCase();
  return use.includes('resid') || use.includes('dwelling');
}

// Helper: is commercial/office
function isCommercialOrOffice(p: PropertyForCompliance): boolean {
  const bc = p.building_class?.charAt(0)?.toUpperCase();
  if (bc && ['O', 'L', 'K', 'E'].includes(bc)) return true;
  const use = (p.use_type || p.primary_use_group || '').toLowerCase();
  return use.includes('office') || use.includes('commercial');
}

// ============================================================
// LOCAL LAW RULES
// ============================================================

function checkLL11(p: PropertyForCompliance): LocalLawRequirement {
  // LL11/98 (FISP) — Facade inspection for buildings > 6 stories
  const stories = p.stories || 0;
  const applies = stories > 6;

  // FISP cycle: 9-year cycles, sub-cycles A/B/C based on block last digit
  // Current Cycle 9: 2020-2028
  let cycleYear: number | null = null;
  let nextDue: string | null = null;
  const blockDigit = getBlockLastDigit(p.bbl);

  if (applies && blockDigit !== null) {
    // Sub-cycle A: last digits 0,1,2,3 (years 1-3 of cycle)
    // Sub-cycle B: last digits 4,5,6 (years 4-6)
    // Sub-cycle C: last digits 7,8,9 (years 7-9)
    if (blockDigit <= 3) {
      cycleYear = 2023; // Sub-cycle A deadline
      nextDue = '2023-02-21';
    } else if (blockDigit <= 6) {
      cycleYear = 2026;
      nextDue = '2026-02-21';
    } else {
      cycleYear = 2029;
      nextDue = '2029-02-21';
    }
  }

  const now = new Date();
  let status: LocalLawRequirement['status'] = 'pending';
  if (!applies) {
    status = 'exempt';
  } else if (nextDue) {
    const dueDate = new Date(nextDue);
    if (dueDate < now) status = 'overdue';
    else {
      const monthsAway = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      status = monthsAway <= 12 ? 'due_soon' : 'pending';
    }
  }

  return {
    local_law: 'LL11',
    requirement_name: 'Facade Inspection (FISP)',
    description: 'Periodic facade inspection and repair for buildings over 6 stories. Filed as a Critical Examination Report every 5 years within a 9-year cycle.',
    applies,
    applicability_reason: applies
      ? `Building has ${stories} stories (>6 required). Block digit ${blockDigit} → Sub-cycle ${blockDigit !== null && blockDigit <= 3 ? 'A' : blockDigit !== null && blockDigit <= 6 ? 'B' : 'C'}.`
      : `Building has ${stories || 'unknown'} stories. LL11 requires >6 stories.`,
    cycle_year: cycleYear,
    next_due_date: nextDue,
    filing_deadline: nextDue,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? '$1,000/month late fee + potential DOB violation' : null,
    status,
    learn_more_url: 'https://www1.nyc.gov/site/buildings/safety/fisp.page',
    tooltip: 'Local Law 11 requires buildings taller than 6 stories to have their facades inspected every 5 years as part of a 9-year inspection cycle.',
  };
}

function checkLL84(p: PropertyForCompliance): LocalLawRequirement {
  // LL84/09 — Energy benchmarking for buildings ≥ 25,000 sqft
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000;

  // Annual filing due May 1
  const currentYear = new Date().getFullYear();
  const nextDue = `${currentYear}-05-01`;
  const now = new Date();
  const dueDate = new Date(nextDue);

  let status: LocalLawRequirement['status'] = 'pending';
  if (!applies) {
    status = 'exempt';
  } else if (dueDate < now) {
    status = 'overdue';
  } else {
    const daysAway = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    status = daysAway <= 90 ? 'due_soon' : 'pending';
  }

  return {
    local_law: 'LL84',
    requirement_name: 'Energy Benchmarking',
    description: 'Annual energy and water benchmarking report filed via EPA Portfolio Manager for buildings ≥ 25,000 sqft.',
    applies,
    applicability_reason: applies
      ? `Building is ${sqft.toLocaleString()} sqft (≥25,000 threshold).`
      : `Building is ${sqft.toLocaleString()} sqft (<25,000 threshold).`,
    cycle_year: currentYear,
    next_due_date: nextDue,
    filing_deadline: nextDue,
    penalty_amount: applies ? 500 : null,
    penalty_description: applies ? '$500 quarterly penalty for non-compliance' : null,
    status,
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/benchmarking.page',
    tooltip: 'Requires annual energy and water usage benchmarking for buildings 25,000+ sqft. Filed through EPA Portfolio Manager by May 1 each year.',
  };
}

function checkLL97(p: PropertyForCompliance): LocalLawRequirement {
  // LL97/19 — Carbon emissions limits for buildings ≥ 25,000 sqft
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000;

  // Period 1: 2024-2029, Period 2: 2030-2034
  const now = new Date();
  const currentYear = now.getFullYear();
  let cycleYear: number;
  let nextDue: string;

  if (currentYear <= 2029) {
    cycleYear = 2025;
    nextDue = '2025-05-01'; // First compliance report
  } else {
    cycleYear = 2030;
    nextDue = '2030-05-01';
  }

  let status: LocalLawRequirement['status'] = 'pending';
  if (!applies) {
    status = 'exempt';
  } else {
    const dueDate = new Date(nextDue);
    if (dueDate < now) status = 'overdue';
    else {
      const monthsAway = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      status = monthsAway <= 12 ? 'due_soon' : 'pending';
    }
  }

  return {
    local_law: 'LL97',
    requirement_name: 'Carbon Emissions Limits',
    description: 'Building carbon emission limits. Period 1 (2024-2029): moderate limits. Period 2 (2030+): stricter limits with significant penalties.',
    applies,
    applicability_reason: applies
      ? `Building is ${sqft.toLocaleString()} sqft (≥25,000). Emission limits apply.`
      : `Building is ${sqft.toLocaleString()} sqft (<25,000 threshold).`,
    cycle_year: cycleYear,
    next_due_date: nextDue,
    filing_deadline: nextDue,
    penalty_amount: applies ? 268 : null,
    penalty_description: applies ? '$268 per metric ton of CO₂ over the limit per year' : null,
    status,
    learn_more_url: 'https://www.nyc.gov/site/sustainablebuildings/ll97/local-law-97.page',
    tooltip: 'Sets carbon emission limits for large buildings. Penalties of $268/ton over the limit. Period 1 limits began in 2024.',
  };
}

function checkLL87(p: PropertyForCompliance): LocalLawRequirement {
  // LL87/09 — Energy audit & retro-commissioning for buildings ≥ 25,000 sqft
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000;

  // 10-year cycle based on last digit of block
  const blockDigit = getBlockLastDigit(p.bbl);
  let cycleYear: number | null = null;
  let nextDue: string | null = null;

  if (applies && blockDigit !== null) {
    // Each block digit corresponds to a specific year in a 10-year cycle
    // Cycle 2: 2023-2032 (digit 3=2023, digit 4=2024, etc.)
    const baseYear = 2020 + blockDigit;
    const currentYear = new Date().getFullYear();
    cycleYear = baseYear;
    while (cycleYear < currentYear - 1) cycleYear += 10;
    nextDue = `${cycleYear}-12-31`;
  }

  let status: LocalLawRequirement['status'] = 'pending';
  if (!applies) {
    status = 'exempt';
  } else if (nextDue) {
    const now = new Date();
    const dueDate = new Date(nextDue);
    if (dueDate < now) status = 'overdue';
    else {
      const monthsAway = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      status = monthsAway <= 12 ? 'due_soon' : 'pending';
    }
  }

  return {
    local_law: 'LL87',
    requirement_name: 'Energy Audit & Retro-Commissioning',
    description: 'Requires energy audit and retro-commissioning every 10 years for buildings ≥ 25,000 sqft.',
    applies,
    applicability_reason: applies
      ? `Building is ${sqft.toLocaleString()} sqft (≥25,000). Block digit ${blockDigit} → due year ${cycleYear}.`
      : `Building is ${sqft.toLocaleString()} sqft (<25,000 threshold).`,
    cycle_year: cycleYear,
    next_due_date: nextDue,
    filing_deadline: nextDue,
    penalty_amount: applies ? 3000 : null,
    penalty_description: applies ? 'DOB violation + potential $3,000+ penalties' : null,
    status,
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/energy-audits.page',
    tooltip: 'Energy audit and retro-commissioning every 10 years. Cycle based on last digit of tax block number.',
  };
}

function checkLL152(p: PropertyForCompliance): LocalLawRequirement {
  // LL152/16 — Gas piping periodic inspection for buildings with gas
  const applies = !!p.has_gas;

  // 4-year cycle based on community district
  // Using block last digit as proxy: 0-3 = cycle 1, 4-6 = cycle 2, 7-9 = cycle 3
  const blockDigit = getBlockLastDigit(p.bbl);
  let cycleYear: number | null = null;
  let nextDue: string | null = null;

  if (applies && blockDigit !== null) {
    if (blockDigit <= 3) {
      cycleYear = 2025;
    } else if (blockDigit <= 6) {
      cycleYear = 2027;
    } else {
      cycleYear = 2029;
    }
    nextDue = `${cycleYear}-12-31`;
  }

  let status: LocalLawRequirement['status'] = 'pending';
  if (!applies) {
    status = 'exempt';
  } else if (nextDue) {
    const now = new Date();
    const dueDate = new Date(nextDue);
    if (dueDate < now) status = 'overdue';
    else {
      const monthsAway = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      status = monthsAway <= 12 ? 'due_soon' : 'pending';
    }
  }

  return {
    local_law: 'LL152',
    requirement_name: 'Gas Piping Inspection',
    description: 'Periodic inspection of gas piping systems by a Licensed Master Plumber every 4 years.',
    applies,
    applicability_reason: applies
      ? 'Building has gas service. Gas piping inspection required.'
      : 'Building does not have gas service. LL152 does not apply.',
    cycle_year: cycleYear,
    next_due_date: nextDue,
    filing_deadline: nextDue,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? 'Up to $10,000 fine + potential gas shutoff' : null,
    status,
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/gas-piping-periodic-inspection.page',
    tooltip: 'Requires gas piping inspection every 4 years by a Licensed Master Plumber. Non-compliance can result in gas service shutoff.',
  };
}

function checkLL62(p: PropertyForCompliance): LocalLawRequirement {
  // LL62/91 — Elevator periodic inspection & testing
  const applies = !!p.has_elevator;

  // Annual CAT1 test, 5-year CAT5 test
  const currentYear = new Date().getFullYear();
  const nextDue = `${currentYear}-12-31`;

  let status: LocalLawRequirement['status'] = 'pending';
  if (!applies) {
    status = 'exempt';
  } else {
    const now = new Date();
    const dueDate = new Date(nextDue);
    const monthsAway = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    status = monthsAway <= 3 ? 'due_soon' : 'pending';
  }

  return {
    local_law: 'LL62',
    requirement_name: 'Elevator Inspection & Testing',
    description: 'Annual Category 1 (CAT1) and 5-year Category 5 (CAT5) elevator testing and inspection.',
    applies,
    applicability_reason: applies
      ? 'Building has elevator(s). Annual CAT1 and periodic CAT5 testing required.'
      : 'Building does not have elevators. LL62 does not apply.',
    cycle_year: currentYear,
    next_due_date: nextDue,
    filing_deadline: nextDue,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'Up to $5,000 penalty per violation + potential DOB seal' : null,
    status,
    learn_more_url: 'https://www1.nyc.gov/site/buildings/safety/elevator-periodic-inspections-and-tests.page',
    tooltip: 'Buildings with elevators must have annual Category 1 inspections and 5-year Category 5 load tests.',
  };
}

function checkLL126(p: PropertyForCompliance): LocalLawRequirement {
  // LL126/21 — Building gas detection (natural gas detectors required)
  // Applies to all buildings with gas
  const applies = !!p.has_gas;
  const currentYear = new Date().getFullYear();

  return {
    local_law: 'LL126',
    requirement_name: 'Gas Detection Devices',
    description: 'Requires installation of natural gas detectors in buildings with gas service. Effective May 1, 2025.',
    applies,
    applicability_reason: applies
      ? 'Building has gas service. Gas detection devices required.'
      : 'Building does not have gas service.',
    cycle_year: currentYear,
    next_due_date: applies ? '2025-05-01' : null,
    filing_deadline: applies ? '2025-05-01' : null,
    penalty_amount: applies ? 2500 : null,
    penalty_description: applies ? 'Up to $2,500 fine for non-compliance' : null,
    status: !applies ? 'exempt' : (new Date() > new Date('2025-05-01') ? 'overdue' : 'due_soon'),
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/gas-detection.page',
    tooltip: 'Requires natural gas leak detectors in all buildings with gas piping. Owners must install and maintain detectors.',
  };
}

function checkLL33(p: PropertyForCompliance): LocalLawRequirement {
  // LL33/07 & LL95/22 — Gas incident inspection after gas-related incident
  const applies = !!p.has_gas;

  return {
    local_law: 'LL33/95',
    requirement_name: 'Post-Gas Incident Inspection',
    description: 'After any gas-related incident, building owner must have gas piping inspected within 90 days.',
    applies,
    applicability_reason: applies
      ? 'Building has gas service. Post-incident inspection obligations apply.'
      : 'Building does not have gas service.',
    cycle_year: null,
    next_due_date: null,
    filing_deadline: null,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? 'Up to $10,000 fine for failure to inspect after incident' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/gas-piping-periodic-inspection.page',
    tooltip: 'If there is a gas-related incident, the owner must commission a gas piping inspection within 90 days.',
  };
}

function checkLL77(p: PropertyForCompliance): LocalLawRequirement {
  // LL77/17 — Crane and derrick wind safety (for buildings under construction or >15 stories near cranes)
  // Simplified: applies to buildings with active construction > 15 stories
  const stories = p.stories || 0;
  const applies = stories > 15;

  return {
    local_law: 'LL77',
    requirement_name: 'Crane Wind Action Plan',
    description: 'Buildings using cranes must have wind action plans. Applies during construction of tall buildings.',
    applies,
    applicability_reason: applies
      ? `Building has ${stories} stories (>15). May require crane wind action plan during construction.`
      : `Building has ${stories || 'unknown'} stories. Typically applies to tall construction sites.`,
    cycle_year: null,
    next_due_date: null,
    filing_deadline: null,
    penalty_amount: applies ? 25000 : null,
    penalty_description: applies ? 'Up to $25,000 per violation' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www1.nyc.gov/site/buildings/safety/cranes-derricks.page',
    tooltip: 'Requires wind action plans for crane operations, especially near tall buildings. Enforced during active construction.',
  };
}

function checkLL88(p: PropertyForCompliance): LocalLawRequirement {
  // LL88/09 — Lighting upgrades for non-residential buildings ≥ 25,000 sqft
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000 && !isResidential(p);

  return {
    local_law: 'LL88',
    requirement_name: 'Lighting Upgrades & Sub-Metering',
    description: 'Non-residential buildings ≥ 25,000 sqft must upgrade lighting to meet energy code and install sub-meters.',
    applies,
    applicability_reason: applies
      ? `Non-residential building at ${sqft.toLocaleString()} sqft (≥25,000). Lighting upgrade required.`
      : sqft < 25000
        ? `Building is ${sqft.toLocaleString()} sqft (<25,000).`
        : 'Building is primarily residential. LL88 targets non-residential space.',
    cycle_year: null,
    next_due_date: null,
    filing_deadline: null,
    penalty_amount: applies ? 1500 : null,
    penalty_description: applies ? 'Potential DOB violation + fines' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/energy-audits.page',
    tooltip: 'Requires sub-metering and lighting upgrades in non-residential buildings 25,000+ sqft to meet NYC Energy Conservation Code.',
  };
}

function checkSprinkler(p: PropertyForCompliance): LocalLawRequirement {
  // Local Law 26/04 — Sprinkler requirements for high-rise commercial buildings
  const stories = p.stories || 0;
  const applies = stories > 7 && isCommercialOrOffice(p);

  return {
    local_law: 'LL26',
    requirement_name: 'Sprinkler Retrofit',
    description: 'Commercial office buildings over 100 feet must be fully sprinklered by July 2019.',
    applies,
    applicability_reason: applies
      ? `Commercial building with ${stories} stories. Sprinkler retrofit required.`
      : 'Not a qualifying high-rise commercial building.',
    cycle_year: null,
    next_due_date: null,
    filing_deadline: null,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'DOB violations + potential penalties' : null,
    status: !applies ? 'exempt' : (p.has_sprinkler ? 'compliant' : 'overdue'),
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/sprinkler-requirements.page',
    tooltip: 'Requires full sprinkler coverage in commercial buildings over 100 feet tall.',
  };
}

// ============================================================
// MAIN ENGINE
// ============================================================

export function getApplicableLaws(property: PropertyForCompliance): LocalLawRequirement[] {
  const allChecks = [
    checkLL11(property),
    checkLL84(property),
    checkLL97(property),
    checkLL87(property),
    checkLL152(property),
    checkLL62(property),
    checkLL126(property),
    checkLL33(property),
    checkLL77(property),
    checkLL88(property),
    checkSprinkler(property),
  ];

  // Sort: applicable laws first, then by status priority
  const statusOrder: Record<string, number> = {
    overdue: 0,
    due_soon: 1,
    pending: 2,
    compliant: 3,
    exempt: 4,
  };

  return allChecks.sort((a, b) => {
    // Applicable first
    if (a.applies !== b.applies) return a.applies ? -1 : 1;
    // Then by status severity
    return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
  });
}

export function getComplianceSummary(requirements: LocalLawRequirement[]) {
  const applicable = requirements.filter(r => r.applies);
  const overdue = applicable.filter(r => r.status === 'overdue').length;
  const dueSoon = applicable.filter(r => r.status === 'due_soon').length;
  const compliant = applicable.filter(r => r.status === 'compliant').length;
  const pending = applicable.filter(r => r.status === 'pending').length;

  return {
    total: applicable.length,
    overdue,
    dueSoon,
    compliant,
    pending,
    exempt: requirements.filter(r => !r.applies).length,
  };
}

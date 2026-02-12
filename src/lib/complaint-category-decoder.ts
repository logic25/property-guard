interface ComplaintInfo {
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

// Official DOB Complaint Categories from nyc.gov/buildings
const COMPLAINT_CATEGORIES: Record<string, ComplaintInfo> = {
  '1': { name: 'Accident – Construction/Plumbing', description: 'Construction or plumbing accident on site', severity: 'critical' },
  '2': { name: 'Accident – To Public', description: 'Accident affecting the public', severity: 'critical' },
  '3': { name: 'Adjacent Buildings – Not Protected', description: 'Adjacent buildings not properly protected during construction', severity: 'high' },
  '4': { name: 'After Hours Work – Illegal', description: 'Construction work being done outside permitted hours', severity: 'medium' },
  '5': { name: 'No Permit', description: 'Building/PA/Demo work without required permit', severity: 'high' },
  '9': { name: 'Debris – Excessive', description: 'Excessive debris accumulation on site', severity: 'medium' },
  '10': { name: 'Falling Debris/Building', description: 'Building or debris falling or in danger of falling', severity: 'critical' },
  '11': { name: 'Demolition – No Permit', description: 'Demolition work without permit', severity: 'high' },
  '12': { name: 'Demolition – Unsafe/Illegal', description: 'Unsafe, illegal, or mechanical demolition', severity: 'critical' },
  '14': { name: 'Excavation Undermining', description: 'Excavation undermining adjacent building', severity: 'critical' },
  '15': { name: 'Fence – None/Inadequate', description: 'Construction fence missing or inadequate', severity: 'medium' },
  '16': { name: 'Inadequate Support/Shoring', description: 'Insufficient support or shoring during construction', severity: 'critical' },
  '1A': { name: 'Illegal Conversion – Commercial to Residential', description: 'Commercial building/space illegally converted to dwelling units', severity: 'critical' },
  '1C': { name: 'Disaster Damage Assessment', description: 'Damage assessment request or report', severity: 'high' },
  '1D': { name: 'Con Edison Referral', description: 'Referral from Con Edison for utility-related issue', severity: 'high' },
  '1E': { name: 'Suspended Scaffolds – Dangerous', description: 'Hanging scaffolds without permit, license, or in dangerous condition', severity: 'critical' },
  '1G': { name: 'Stalled Construction Site', description: 'Construction site that has stalled', severity: 'medium' },
  '1L': { name: 'Gas Utility Referral', description: 'Referral from gas utility company', severity: 'high' },
  '20': { name: 'Landmark – Illegal Work', description: 'Illegal work on a landmark building', severity: 'high' },
  '21': { name: 'Safety Net/Guard Rail – Inadequate', description: 'Safety net or guard rail damaged, inadequate, or missing (over 6 stories)', severity: 'critical' },
  '23': { name: 'Sidewalk Shed/Scaffold – Defective', description: 'Sidewalk shed or supported scaffold inadequate, defective, or missing', severity: 'high' },
  '27': { name: 'Auto Repair – Illegal', description: 'Illegal auto repair shop operation', severity: 'medium' },
  '28': { name: 'Building – Danger of Collapse', description: 'Building in danger of collapse', severity: 'critical' },
  '29': { name: 'Building – Vacant/Open/Unguarded', description: 'Vacant building that is open and unguarded', severity: 'high' },
  '2A': { name: 'Posted Notice Tampered', description: 'Posted notice or order removed or tampered with', severity: 'high' },
  '2B': { name: 'Failure to Comply with Vacate Order', description: 'Occupants not complying with vacate order', severity: 'critical' },
  '2G': { name: 'Illegal Sign/Billboard', description: 'Advertising sign, billboard, or poster installed illegally', severity: 'medium' },
  '2K': { name: 'Structurally Compromised Building', description: 'Building structurally compromised per LL33/08', severity: 'critical' },
  '2L': { name: 'Façade – Unsafe (LL11/98)', description: 'Unsafe façade notification under Local Law 11', severity: 'critical' },
  '30': { name: 'Building Shaking/Vibrating', description: 'Building shaking, vibrating, or structural stability affected', severity: 'critical' },
  '31': { name: 'Certificate of Occupancy – None/Illegal', description: 'No Certificate of Occupancy or use contrary to CO', severity: 'high' },
  '32': { name: 'C of O – Not Complied With', description: 'Certificate of Occupancy not being complied with', severity: 'high' },
  '33': { name: 'Commercial Use – Illegal', description: 'Illegal commercial use of building/space', severity: 'high' },
  '35': { name: 'Curb Cut/Driveway – Illegal', description: 'Illegal curb cut, driveway, or carport', severity: 'medium' },
  '37': { name: 'Egress – Locked/Blocked/Improper', description: 'Emergency exit locked, blocked, or improper egress', severity: 'critical' },
  '38': { name: 'Exit Door Not Proper', description: 'Exit door not meeting code requirements', severity: 'high' },
  '3A': { name: 'Illegal/Improper Electrical Work', description: 'Unlicensed or improper electrical work in progress', severity: 'high' },
  '40': { name: 'Falling – Part of Building', description: 'Part of building is falling', severity: 'critical' },
  '41': { name: 'Falling – In Danger Of', description: 'Part of building in danger of falling', severity: 'critical' },
  '43': { name: 'Structural Stability Affected', description: 'Structural stability of building affected', severity: 'critical' },
  '45': { name: 'Illegal Conversion', description: 'Building illegally converted to different use/occupancy', severity: 'critical' },
  '48': { name: 'Residential Use – Illegal', description: 'Illegal residential use of space', severity: 'high' },
  '49': { name: 'Illegal Sign/Awning/Canopy', description: 'Storefront sign, awning, marquee, or canopy installed illegally', severity: 'medium' },
  '4A': { name: 'Illegal Hotel Rooms', description: 'Illegal hotel rooms in residential buildings', severity: 'critical' },
  '4B': { name: 'Professional Certification Audit', description: 'SEP professional certification compliance audit', severity: 'medium' },
  '50': { name: 'Sign Falling/Illegal Erection', description: 'Sign falling or sign erection/display in progress illegally', severity: 'high' },
  '52': { name: 'Sprinkler System – Inadequate', description: 'Sprinkler system inadequate or defective', severity: 'high' },
  '53': { name: 'Vent/Exhaust – Illegal/Improper', description: 'Illegal or improper ventilation or exhaust', severity: 'medium' },
  '54': { name: 'Wall/Retaining Wall – Bulging/Cracked', description: 'Wall or retaining wall is bulging or cracked', severity: 'critical' },
  '55': { name: 'Zoning – Non-Conforming', description: 'Non-conforming use under zoning regulations', severity: 'medium' },
  '56': { name: 'Boiler – Fumes/Smoke/CO', description: 'Boiler producing fumes, smoke, or carbon monoxide', severity: 'critical' },
  '57': { name: 'Boiler – Illegal', description: 'Illegal boiler installation', severity: 'high' },
  '58': { name: 'Boiler – Defective/No Permit', description: 'Boiler defective, inoperative, or without permit', severity: 'high' },
  '59': { name: 'Electrical Wiring – Defective/Exposed', description: 'Defective or exposed electrical wiring in progress', severity: 'high' },
  '5G': { name: 'Illegal/Improper Work In-Progress', description: 'Unlicensed, illegal, or improper work in progress', severity: 'high' },
  '62': { name: 'Elevator – Danger Condition', description: 'Elevator dangerous condition or shaft open/unguarded', severity: 'critical' },
  '63': { name: 'Elevator – Defective/Inoperative', description: 'Elevator defective or inoperative', severity: 'high' },
  '65': { name: 'Gas Hook-Up/Piping – Illegal/Defective', description: 'Illegal or defective gas hook-up or piping', severity: 'critical' },
  '66': { name: 'Plumbing Work – Illegal/No Permit', description: 'Illegal plumbing work or work without permit', severity: 'high' },
  '67': { name: 'Crane – Unsafe/Illegal/No Permit', description: 'Crane without permit, license, or in unsafe condition', severity: 'critical' },
  '71': { name: 'SRO – Illegal Work/No Permit', description: 'Illegal work or occupancy change in Single Room Occupancy building', severity: 'high' },
  '73': { name: 'Failure to Maintain', description: 'Failure to maintain building in safe condition', severity: 'medium' },
  '74': { name: 'Illegal Commercial/Manufacturing Use', description: 'Illegal commercial or manufacturing use in residential zone', severity: 'high' },
  '76': { name: 'Illegal Plumbing Work In-Progress', description: 'Unlicensed or improper plumbing work in progress', severity: 'high' },
  '77': { name: 'Handicap Access Non-Compliance', description: 'Non-compliance with LL58/87 (handicap access requirements)', severity: 'medium' },
  '80': { name: 'Elevator Not Inspected/Illegal', description: 'Elevator not inspected, illegal, or without permit', severity: 'high' },
  '81': { name: 'Elevator Accident', description: 'Elevator accident occurred', severity: 'critical' },
  '82': { name: 'Boiler Accident/Explosion', description: 'Boiler accident or explosion', severity: 'critical' },
  '83': { name: 'Construction Beyond Approved Plans', description: 'Construction contrary to or beyond approved plans/permits', severity: 'high' },
  '84': { name: 'Façade – Defective/Cracking', description: 'Building façade is defective or cracking', severity: 'high' },
  '85': { name: 'Improper Drainage', description: 'Failure to retain water or improper drainage per LL103/89', severity: 'medium' },
  '86': { name: 'Work Contrary to Stop Work Order', description: 'Work being done contrary to a stop work order', severity: 'critical' },
  '90': { name: 'Unlicensed/Illegal Activity', description: 'Unlicensed or illegal activity at building', severity: 'high' },
  '91': { name: 'Site Conditions Endangering Workers', description: 'Site conditions that endanger workers', severity: 'critical' },
  '92': { name: 'Illegal Conversion – Industrial', description: 'Illegal conversion of manufacturing or industrial space', severity: 'high' },
  '94': { name: 'Plumbing – Defective/Leaking', description: 'Plumbing defective, leaking, or not maintained', severity: 'medium' },
  '7J': { name: 'Work Without Permit – Occupied Dwelling', description: 'Work without a permit in an occupied multiple dwelling', severity: 'high' },
};

export function decodeComplaintCategory(code: string | null | undefined): ComplaintInfo | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return COMPLAINT_CATEGORIES[normalized] || null;
}

export function getComplaintSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-200';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-200';
    case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
    case 'low': return 'bg-blue-500/10 text-blue-600 border-blue-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

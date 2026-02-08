// Agency-specific violation lookup URLs
export const getAgencyLookupUrl = (agency: string, violationNumber: string, bbl?: string | null) => {
  const borough = bbl ? bbl.charAt(0) : '3';
  const block = bbl ? bbl.slice(1, 6) : '';
  const lot = bbl ? bbl.slice(6, 10) : '';

  switch (agency) {
    case 'DOB':
      // DOB BIS - Building Information System
      if (bbl) {
        return `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=${borough}&block=${block}&lot=${lot}`;
      }
      return `https://a810-bisweb.nyc.gov/bisweb/bispi00.jsp`;
    
    case 'ECB':
      // ECB goes to OATH Summons Finder
      return `http://a820-ecbticketfinder.nyc.gov/searchHome.action`;
    
    case 'HPD':
      // HPD Online
      if (bbl) {
        return `https://hpdonline.nyc.gov/HPDonline/Provide_address.aspx`;
      }
      return `https://hpdonline.nyc.gov/HPDonline/`;
    
    case 'FDNY':
      // FDNY violations portal
      return `https://fires.fdnycloud.org/CitizenAccess/`;
    
    case 'DEP':
      // DEP portal
      return `https://www1.nyc.gov/site/dep/about/contact-us.page`;
    
    case 'DOT':
      // DOT permits and violations
      return `https://nycstreets.net/`;
    
    case 'DSNY':
      // Sanitation - 311
      return `https://portal.311.nyc.gov/`;
    
    case 'LPC':
      // Landmarks Preservation
      return `https://www1.nyc.gov/site/lpc/index.page`;
    
    case 'DOF':
      // Dept of Finance - property tax
      if (bbl) {
        return `https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop`;
      }
      return `https://www1.nyc.gov/site/finance/taxes/property.page`;
    
    default:
      return `http://a820-ecbticketfinder.nyc.gov/searchHome.action`;
  }
};

export const getAgencyDisplayName = (agency: string) => {
  const names: Record<string, string> = {
    DOB: 'Dept. of Buildings',
    ECB: 'Environmental Control Board',
    HPD: 'Housing Preservation',
    FDNY: 'Fire Department',
    DEP: 'Environmental Protection',
    DOT: 'Dept. of Transportation',
    DSNY: 'Sanitation',
    LPC: 'Landmarks',
    DOF: 'Dept. of Finance',
  };
  return names[agency] || agency;
};

export const getAgencyColor = (agency: string) => {
  const colors: Record<string, string> = {
    FDNY: 'bg-red-500/10 text-red-600 border-red-200',
    DOB: 'bg-orange-500/10 text-orange-600 border-orange-200',
    ECB: 'bg-blue-500/10 text-blue-600 border-blue-200',
    HPD: 'bg-purple-500/10 text-purple-600 border-purple-200',
    DEP: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
    DOT: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    DSNY: 'bg-green-500/10 text-green-600 border-green-200',
    LPC: 'bg-pink-500/10 text-pink-600 border-pink-200',
    DOF: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  };
  return colors[agency] || 'bg-gray-500/10 text-gray-600 border-gray-200';
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-destructive/10 text-destructive';
    case 'in_progress': return 'bg-warning/10 text-warning';
    case 'closed': return 'bg-success/10 text-success';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const getOATHLookupUrl = (ticketNumber: string) => {
  // Correct URL: a820-ecbticketfinder.nyc.gov/searchHome.action
  return `http://a820-ecbticketfinder.nyc.gov/searchHome.action`;
};

// Violation statuses that indicate resolution - exclude from active counts
export const RESOLVED_VIOLATION_STATUSES = [
  'written off',
  'closed',
  'dismissed',
  'paid',
  'paid in full',
  'resolved',
  'complied',
  'withdrawn',
  'stipulation',
  'default - paid',
  'in violation - resolved',
  'in violation - paid',
];

// Check if a violation status indicates it's resolved
export const isResolvedViolationStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const normalizedStatus = status.toLowerCase().trim();
  return RESOLVED_VIOLATION_STATUSES.some((resolved) =>
    normalizedStatus.includes(resolved) || resolved.includes(normalizedStatus)
  );
};

// Check if a violation should be counted as active
export const isActiveViolation = (violation: {
  status?: string | null;
  oath_status?: string | null;
}): boolean => {
  // Exclude anything explicitly resolved first
  if (violation.status === 'closed') return false;
  if (isResolvedViolationStatus(violation.status)) return false;
  if (isResolvedViolationStatus(violation.oath_status)) return false;

  // Otherwise it's active (even if the OATH status is "Docketed", "Rescheduled", etc.)
  return true;
};

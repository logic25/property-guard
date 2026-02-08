// Property type detection utilities

export type Agency = 'DOB' | 'ECB' | 'HPD' | 'FDNY' | 'DOT' | 'DSNY';

export function determineApplicableAgencies(
  primaryUseGroup: string | null,
  dwellingUnits: number | null
): Agency[] {
  const occupancy = (primaryUseGroup || '').toUpperCase();
  const units = dwellingUnits || 0;

  // Multi-family residential (3+ units or R-2/R-1 occupancy)
  if (
    occupancy.includes('R-2') ||
    occupancy.includes('R-1') ||
    units >= 3
  ) {
    return ['DOB', 'ECB', 'HPD', 'FDNY'];
  }

  // Commercial/retail (M or B occupancy)
  if (occupancy.includes('M') || occupancy.includes('B')) {
    // DO NOT include HPD for commercial
    return ['DOB', 'ECB', 'FDNY'];
  }

  // 1-2 family residential
  if (occupancy.includes('R-3') && units < 3) {
    // HPD only for lead paint issues (handled separately)
    return ['DOB', 'ECB', 'FDNY'];
  }

  // Default: basic agencies
  return ['DOB', 'ECB'];
}

export type COStatus = 'valid' | 'temporary' | 'expired_tco' | 'missing' | 'pre_1938' | 'use_violation' | 'unknown';

export interface COStatusResult {
  status: COStatus;
  icon: string;
  message: string;
  severity: 'ok' | 'warning' | 'critical' | 'unknown';
}

export function determineCOStatus(
  coData: Record<string, unknown> | null,
  yearBuilt?: number | null
): COStatusResult {
  if (!coData || !coData.has_co) {
    if (yearBuilt && yearBuilt < 1938) {
      return {
        status: 'pre_1938',
        icon: '🏛️',
        message: 'Pre-1938 building',
        severity: 'ok',
      };
    }
    return {
      status: 'missing',
      icon: '🔴',
      message: 'No Certificate of Occupancy',
      severity: 'critical',
    };
  }

  if (coData.is_temporary && coData.is_expired) {
    return {
      status: 'expired_tco',
      icon: '🔴',
      message: 'Temporary CO expired',
      severity: 'critical',
    };
  }

  if (coData.is_temporary && !coData.is_expired && coData.expiration_date) {
    const daysUntil = Math.ceil(
      (new Date(coData.expiration_date as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return {
      status: 'temporary',
      icon: '🟡',
      message: `TCO expires in ${daysUntil} days`,
      severity: 'warning',
    };
  }

  if (coData.use_violation) {
    return {
      status: 'use_violation',
      icon: '🟡',
      message: 'Use violation detected',
      severity: 'warning',
    };
  }

  return {
    status: 'valid',
    icon: '🟢',
    message: `Valid CO${coData.co_number ? ` #${coData.co_number}` : ''}`,
    severity: 'ok',
  };
}

export function formatBBL(borough: string, block: string, lot: string): string {
  const boroughCode = getBoroughCode(borough);
  const paddedBlock = block.padStart(5, '0');
  const paddedLot = lot.padStart(4, '0');
  return `${boroughCode}${paddedBlock}${paddedLot}`;
}

export function getBoroughCode(borough: string): string {
  const boroughMap: Record<string, string> = {
    'manhattan': '1',
    'bronx': '2',
    'brooklyn': '3',
    'queens': '4',
    'staten island': '5',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
  };
  return boroughMap[borough?.toLowerCase()] || '0';
}

export function getBoroughName(code: string): string {
  const boroughs: Record<string, string> = {
    '1': 'Manhattan',
    '2': 'Bronx',
    '3': 'Brooklyn',
    '4': 'Queens',
    '5': 'Staten Island',
  };
  return boroughs[code] || code;
}

// Violation severity calculation with explanations and recommended actions
// Per spec §2 - Severity Logic

export interface SeverityResult {
  level: 'Critical' | 'High' | 'Medium' | 'Low';
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  explanation: string;
  recommended_action: string;
}

const CRITICAL_KEYWORDS = [
  'vacate', 'stop work', 'swo', 'unsafe', 'work without permit',
  'illegal conversion', 'imminent danger', 'collapse', 'emergency',
  'no permit', 'cease', 'life safety', 'fire escape'
];

const HIGH_KEYWORDS = [
  'safety', 'structural', 'facade', 'll11', 'local law 11',
  'll196', 'local law 196', 'scaffold', 'sidewalk shed',
  'parapet', 'exterior wall', 'retaining wall', 'failure to maintain',
  'gas', 'boiler', 'elevator', 'sprinkler', 'standpipe',
  'means of egress', 'fire alarm', 'fire suppression'
];

const MEDIUM_KEYWORDS = [
  'complaint', 'quality of life', 'permit', 'noise',
  'construction fence', 'signage', 'certificate of occupancy',
  'plumbing', 'electrical', 'hvac', 'maintenance',
  'zoning', 'alteration', 'administrative'
];

export function calculateViolationSeverity(violation: {
  description_raw?: string | null;
  violation_type?: string | null;
  violation_class?: string | null;
  agency?: string;
  is_stop_work_order?: boolean;
  is_vacate_order?: boolean;
  penalty_amount?: number | null;
  severity?: string | null;
}): SeverityResult {
  // Check explicit flags first
  if (violation.is_stop_work_order || violation.is_vacate_order) {
    return {
      level: 'Critical',
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-200',
      icon: '🔴',
      explanation: violation.is_stop_work_order
        ? 'This Stop Work Order halts all construction activity. Continuing work risks additional penalties and criminal charges.'
        : 'This Vacate Order requires immediate evacuation. The building or area is deemed unsafe for occupancy.',
      recommended_action: violation.is_stop_work_order
        ? 'File permit application or correction documents within 48 hours. Schedule DOB inspection to lift order. Do NOT resume work until SWO is officially rescinded.'
        : 'Ensure all occupants have vacated the affected area. Engage a licensed engineer to assess conditions. File for re-occupancy after DOB inspection.'
    };
  }

  const text = [
    violation.description_raw || '',
    violation.violation_type || '',
    violation.violation_class || '',
    violation.severity || ''
  ].join(' ').toLowerCase();

  // Check Critical
  if (CRITICAL_KEYWORDS.some(k => text.includes(k))) {
    return {
      level: 'Critical',
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-200',
      icon: '🔴',
      explanation: 'This violation involves a serious safety concern or unauthorized work that requires immediate attention.',
      recommended_action: 'Address within 48 hours. Contact your expediter or file corrective documents with the issuing agency immediately. Failure to act may result in escalated penalties or criminal referral.'
    };
  }

  // Check High
  if (HIGH_KEYWORDS.some(k => text.includes(k)) || violation.agency === 'FDNY') {
    return {
      level: 'High',
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-200',
      icon: '🟠',
      explanation: 'This violation relates to building safety systems, structural integrity, or fire safety. These typically carry significant penalties if unresolved.',
      recommended_action: 'Schedule inspection or file corrective action within 1-2 weeks. Engage a licensed professional (PE/RA) if structural or facade-related. Track hearing dates closely.'
    };
  }

  // Check Medium
  if (MEDIUM_KEYWORDS.some(k => text.includes(k))) {
    return {
      level: 'Medium',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-200',
      icon: '🟡',
      explanation: 'This violation involves permits, complaints, or maintenance issues. While not immediately dangerous, unresolved issues may escalate.',
      recommended_action: 'Review violation details and prepare response before hearing date. File necessary permits or corrections. Consider attending ECB hearing to contest or settle.'
    };
  }

  // High penalty = bump to Medium at least
  if (violation.penalty_amount && violation.penalty_amount >= 5000) {
    return {
      level: 'Medium',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-200',
      icon: '🟡',
      explanation: `This violation carries a significant penalty of $${violation.penalty_amount.toLocaleString()}. Prompt resolution may reduce the financial exposure.`,
      recommended_action: 'Review penalty details and consider filing for a hearing to negotiate reduction. Ensure underlying condition is corrected to prevent additional daily penalties.'
    };
  }

  // Default: Low
  return {
    level: 'Low',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-200',
    icon: '🔵',
    explanation: 'This is a lower-priority violation. It should still be addressed but poses minimal immediate risk.',
    recommended_action: 'Add to your compliance tracking queue. Address during next scheduled maintenance or before permit renewals. Monitor for status changes.'
  };
}

export function getSeverityBadgeClasses(level: string): string {
  switch (level) {
    case 'Critical':
      return 'bg-red-500/10 text-red-600 border-red-200';
    case 'High':
      return 'bg-orange-500/10 text-orange-600 border-orange-200';
    case 'Medium':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
    case 'Low':
      return 'bg-blue-500/10 text-blue-600 border-blue-200';
    default:
      return 'bg-muted text-muted-foreground border-muted';
  }
}

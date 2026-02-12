interface AgingRule {
  agency: string;
  suppressAfterDays: number;
  reason: string;
}

const AGING_RULES: AgingRule[] = [
  {
    agency: 'ECB',
    suppressAfterDays: 730, // 2 years
    reason: 'ECB violations open >2 years are likely resolved but not updated in system',
  },
  {
    agency: 'DOB',
    suppressAfterDays: 1095, // 3 years
    reason: 'DOB violations open >3 years may be disputed or administratively stale',
  },
  {
    agency: 'HPD',
    suppressAfterDays: 1095, // 3 years
    reason: 'HPD violations open >3 years likely corrected but not closed',
  },
];

export function shouldSuppressViolation(violation: {
  agency: string;
  issued_date: string;
  status: string;
  suppressed?: boolean;
}): { suppress: boolean; reason?: string } {
  // Only suppress open violations
  if (violation.status !== 'open') {
    return { suppress: false };
  }

  const issueDate = new Date(violation.issued_date);
  const daysSinceIssue = Math.floor(
    (Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const rule = AGING_RULES.find(r => violation.agency === r.agency);

  if (rule && daysSinceIssue > rule.suppressAfterDays) {
    const years = Math.floor(daysSinceIssue / 365);
    return {
      suppress: true,
      reason: `${rule.reason} (${years} year${years !== 1 ? 's' : ''} old)`,
    };
  }

  return { suppress: false };
}

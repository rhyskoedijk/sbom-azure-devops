import { ISeverity } from './ISeverity';

export const SECURITY_ADVISORY_SEVERITIES: ISeverity[] = [
  { id: 0, name: 'None', prefix: 'N', color: { red: 127, green: 127, blue: 127 } },
  { id: 1, name: 'Low', prefix: 'L', color: { red: 0, green: 120, blue: 212 } },
  { id: 2, name: 'Moderate', prefix: 'M', color: { red: 214, green: 119, blue: 48 } },
  { id: 3, name: 'High', prefix: 'H', color: { red: 205, green: 74, blue: 69 } },
  { id: 4, name: 'Critical', prefix: 'C', color: { red: 162, green: 48, blue: 44 } },
];

export const DEFAULT_SECURITY_ADVISORY_SEVERITY: ISeverity = SECURITY_ADVISORY_SEVERITIES[0];

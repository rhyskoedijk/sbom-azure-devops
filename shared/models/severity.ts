import { IColor } from './color';

export interface ISeverity {
  id: number;
  name: string;
  prefix: string;
  color: IColor;
  weight: number;
}

export const SEVERITIES: ISeverity[] = [
  { id: 0, name: 'None', prefix: 'N', color: { red: 127, green: 127, blue: 127 }, weight: 0 },
  { id: 1, name: 'Low', prefix: 'L', color: { red: 0, green: 120, blue: 212 }, weight: 0.00000001 },
  { id: 2, name: 'Moderate', prefix: 'M', color: { red: 214, green: 119, blue: 48 }, weight: 0.000001 },
  { id: 3, name: 'High', prefix: 'H', color: { red: 205, green: 74, blue: 69 }, weight: 0.0001 },
  { id: 4, name: 'Critical', prefix: 'C', color: { red: 162, green: 48, blue: 44 }, weight: 0.01 },
];

export const DEFAULT_SEVERITY: ISeverity = SEVERITIES[0];
export const LOW_SEVERITY: ISeverity = SEVERITIES[1];
export const MODERATE_SEVERITY: ISeverity = SEVERITIES[2];
export const HIGH_SEVERITY: ISeverity = SEVERITIES[3];
export const CRITICAL_SEVERITY: ISeverity = SEVERITIES[4];

export function getSeverityByName(name: string): ISeverity {
  const normalizedName = name?.toUpperCase();
  return SEVERITIES.find((s) => s.name?.toUpperCase() === normalizedName) || DEFAULT_SEVERITY;
}

export const NONE = 'NONE';
export const NOASSERTION = 'NOASSERTION';

export function spdxNormalised(constant: string): string {
  return constant?.replace(/\-/g, '_')?.toUpperCase()?.trim();
}

export function spdxConstantsAreEqual(a: string, b: string): boolean {
  return spdxNormalised(a) === spdxNormalised(b);
}

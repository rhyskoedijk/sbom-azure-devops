export interface IColor {
  red: number;
  green: number;
  blue: number;
}

export function getHexStringFromColor(color: IColor): string {
  return `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`;
}

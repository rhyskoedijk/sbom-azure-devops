import { IColor } from './IColor';

export interface ISeverity {
  id: number;
  name: string;
  prefix: string;
  color: IColor;
  weight: number;
}

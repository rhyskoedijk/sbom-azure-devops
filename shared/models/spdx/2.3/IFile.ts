import { IChecksum } from './IChecksum';

export interface IFile {
  fileName: string;
  SPDXID: string;
  checksums: IChecksum[];
  licenseConcluded: string;
  licenseInfoInFiles: string[];
  copyrightText: string;
}

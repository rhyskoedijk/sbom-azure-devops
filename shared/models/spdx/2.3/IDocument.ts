import { ICreationInfo } from './ICreationInfo';
import { IFile } from './IFile';
import { IPackage } from './IPackage';
import { IRelationship } from './IRelationship';

/**
 * https://spdx.github.io/spdx-spec/v2.3/document-creation-information/
 */
export interface IDocument {
  files: IFile[];
  packages: IPackage[];
  externalDocumentRefs: any[];
  relationships: IRelationship[];
  spdxVersion: DocumentVersion | string;
  dataLicense: string;
  SPDXID: string;
  name: string;
  documentNamespace: string;
  creationInfo: ICreationInfo;
  documentDescribes: string[];
}

export enum DocumentVersion {
  SPDX_2_2 = 'SPDX-2.2',
  SPDX_2_3 = 'SPDX-2.3',
}

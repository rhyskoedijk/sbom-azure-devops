import { ICreationInfo } from './ICreationInfo';
import { IFile } from './IFile';
import { IPackage } from './IPackage';
import { IRelationship } from './IRelationship';

export interface IDocument {
  files: IFile[];
  packages: IPackage[];
  externalDocumentRefs: any[];
  relationships: IRelationship[];
  spdxVersion: string;
  dataLicense: string;
  SPDXID: string;
  name: string;
  documentNamespace: string;
  creationInfo: ICreationInfo;
  documentDescribes: string[];
}

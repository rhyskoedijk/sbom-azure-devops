export interface ISpdx22Document {
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

export interface IFile {
  fileName: string;
  SPDXID: string;
  checksums: IChecksum[];
  licenseConcluded: string;
  licenseInfoInFiles: string[];
  copyrightText: string;
}

export interface IChecksum {
  algorithm: string;
  checksumValue: string;
}

export interface IPackage {
  name: string;
  SPDXID: string;
  downloadLocation: string;
  filesAnalyzed: boolean;
  licenseConcluded: string;
  licenseDeclared: string;
  copyrightText: string;
  versionInfo: string;
  externalRefs: IExternalRef[];
  supplier: string;
  packageVerificationCode?: IPackageVerificationCode;
  licenseInfoFromFiles?: string[];
  hasFiles?: string[];
}

export interface IExternalRef {
  referenceCategory: string;
  referenceType: string;
  referenceLocator: string;
  comment?: string;
}

export interface IPackageVerificationCode {
  packageVerificationCodeValue: string;
}

export interface IRelationship {
  relationshipType: string;
  relatedSpdxElement: string;
  spdxElementId: string;
}

export interface ICreationInfo {
  created: string;
  creators: string[];
}

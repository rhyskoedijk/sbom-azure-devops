export interface IExternalRef {
  referenceCategory: ExternalRefCategory;
  referenceType: ExternalRefSecurityType | ExternalRefPackageManagerType | ExternalRefPersistentIdType | string;
  referenceLocator: string;
  comment?: string;
}

export enum ExternalRefCategory {
  Security = 'SECURITY',
  PackageManager = 'PACKAGE-MANAGER',
  PersistentId = 'PERSISTENT-ID',
  Other = 'OTHER',
}

export enum ExternalRefSecurityType {
  Cpe22Type = 'cpe22type',
  Cpe23Type = 'cpe23type',
  Advisory = 'advisory',
  Fix = 'fix',
  Url = 'url',
  Swid = 'swid',
}

export enum ExternalRefPackageManagerType {
  MavenCentral = 'maven-central',
  Npm = 'npm',
  NuGet = 'nuget',
  Bower = 'bower',
  PackageUrl = 'purl',
}

export enum ExternalRefPersistentIdType {
  Swh = 'swh',
  Gitoid = 'gitoid',
}

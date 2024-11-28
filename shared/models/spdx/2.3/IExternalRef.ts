import { Buffer } from 'buffer';
import '../../../extensions/StringExtensions';

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

export function parseExternalRefsAs<T>(externalRefs: IExternalRef[], category: ExternalRefCategory, type: string): T[] {
  return externalRefs
    .filter(
      (ref) =>
        ref.referenceCategory === category &&
        ref.referenceType === type &&
        ref.referenceLocator.match(/data\:text\/json\;base64/i),
    )
    .map((ref) => JSON.parse(Buffer.from(ref.referenceLocator?.split(',')[1] || '', 'base64').toString('utf-8')) as T)
    .filter((x) => x);
}

export function getExternalRefPackageManager(externalRefs: IExternalRef[]): string | undefined {
  return externalRefs
    .find(
      (ref) =>
        ref.referenceCategory === ExternalRefCategory.PackageManager &&
        ref.referenceType === ExternalRefPackageManagerType.PackageUrl,
    )
    ?.referenceLocator?.match(/^pkg\:([^\:]+)\//i)?.[1]
    ?.toPascalCase()
    ?.trim();
}

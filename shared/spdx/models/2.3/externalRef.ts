import { Buffer } from 'buffer';
import { PackageURL } from 'packageurl-js';

import { spdxConstantsAreEqual } from './constants';

import '../../../extensions/string';

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

export function parseExternalRefsAs<T>(
  externalRefs: IExternalRef[],
  category: ExternalRefCategory,
  type: string,
  customParser?: (ref: IExternalRef) => T,
): T[] | undefined {
  const filteredRefs = externalRefs.filter(
    (ref) =>
      (spdxConstantsAreEqual(ref.referenceCategory, category) &&
        spdxConstantsAreEqual(ref.referenceType, type) &&
        customParser) ||
      ref.referenceLocator.match(/data\:text\/json\;base64/i),
  );
  if (filteredRefs.length) {
    return filteredRefs
      .map((ref) =>
        customParser
          ? customParser(ref)
          : (JSON.parse(Buffer.from(ref.referenceLocator?.split(',')[1] || '', 'base64').toString('utf-8')) as T),
      )
      .filter((x) => x);
  }
}

export function getExternalRefPackageManagerName(externalRefs: IExternalRef[]): string | undefined {
  const packageManager = externalRefs.find((ref) =>
    spdxConstantsAreEqual(ref.referenceCategory, ExternalRefCategory.PackageManager),
  );
  switch (packageManager?.referenceType) {
    case ExternalRefPackageManagerType.MavenCentral:
      return 'Maven Central';
    case ExternalRefPackageManagerType.Npm:
      return 'NPM';
    case ExternalRefPackageManagerType.NuGet:
      return 'NuGet';
    case ExternalRefPackageManagerType.Bower:
      return 'Bower';
    case ExternalRefPackageManagerType.PackageUrl:
      return PackageURL.fromString(packageManager.referenceLocator)?.type?.toPascalCase();
    default:
      return undefined;
  }
}

export function getExternalRefPackageManagerUrl(externalRefs: IExternalRef[]): string | undefined {
  const packageManager = externalRefs.find((ref) =>
    spdxConstantsAreEqual(ref.referenceCategory, ExternalRefCategory.PackageManager),
  );
  switch (packageManager?.referenceType) {
    case ExternalRefPackageManagerType.MavenCentral:
      return `https://search.maven.org/artifact/${packageManager.referenceLocator.replace(/\:/g, '/')}/pom`;
    case ExternalRefPackageManagerType.Npm:
      const npmPkg = packageManager.referenceLocator.split('@');
      return `https://www.npmjs.com/package/${npmPkg[0]}/v/${npmPkg[1]}`;
    case ExternalRefPackageManagerType.NuGet:
      return `https://www.nuget.org/packages/${packageManager.referenceLocator}`;
    case ExternalRefPackageManagerType.Bower:
      const yarnPkg = packageManager.referenceLocator.split('#');
      return `https://yarnpkg.com/package?name=${yarnPkg[0]}&version=${yarnPkg[1]}`;
    case ExternalRefPackageManagerType.PackageUrl:
      const purl = PackageURL.fromString(packageManager.referenceLocator);
      if (!purl) return undefined;
      // TODO: Add all supported types from https://github.com/package-url/purl-spec/blob/master/PURL-TYPES.rst
      switch (purl.type) {
        case 'npm':
          return `https://www.npmjs.com/package/${purl.namespace ? purl.namespace + '/' : ''}${purl.name}/v/${purl.version}`;
        case 'nuget':
          return `https://www.nuget.org/packages/${purl.name}/${purl.version}`;
        default:
          return undefined;
      }
    default:
      return undefined;
  }
}

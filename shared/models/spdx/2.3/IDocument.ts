import { spdxConstantsAreEqual } from './Constants';
import { ICreationInfo } from './ICreationInfo';
import { IFile } from './IFile';
import { IPackage } from './IPackage';
import { IRelationship, RelationshipType } from './IRelationship';

/**
 * https://spdx.github.io/spdx-spec/v2.3/document-creation-information/
 */
export interface IDocument {
  files: IFile[];
  packages: IPackage[];
  externalDocumentRefs: any[];
  relationships: IRelationship[];
  spdxVersion: DocumentVersion | string;
  dataLicense: DocumentDataLicense | string;
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

export enum DocumentDataLicense {
  CC0_1_0 = 'CC0-1.0',
}

export function getDisplayNameForDocument(document: IDocument): string | undefined {
  const describesPackageIds = document.documentDescribes;
  const packages = document.packages?.filter((p) => describesPackageIds.includes(p.SPDXID))?.map((p) => p.name);
  if (packages?.length > 1) {
    return `${packages[0]} + ${packages.length - 1} package(s)`;
  } else if (packages?.length == 1) {
    return packages[0] || '';
  }
}

export function getPackageDependsOnChain(document: IDocument, packageId: string): IPackage[] {
  const hasMultipleRootPackages = document.documentDescribes.length > 1;
  const rootPackageIds = document.documentDescribes;
  const relationships = document.relationships || [];
  const dependsOnRelationships = relationships.filter((r) =>
    spdxConstantsAreEqual(r.relationshipType, RelationshipType.DependsOn),
  );
  const packages = (document.packages || []).filter((p) => {
    return hasMultipleRootPackages || !rootPackageIds.includes(p.SPDXID);
  });

  // Walk the chain of "DependsOn" relationships for the package to discover the dependencies
  const packageChain: IPackage[] = [];
  let currentElementId = packageId;
  while (currentElementId) {
    const relationship = dependsOnRelationships.find((r) => r.relatedSpdxElement === currentElementId);
    if (!relationship) break;

    const pkg = packages.find((p) => p.SPDXID === relationship.spdxElementId);
    if (!pkg) break;

    packageChain.unshift(pkg);
    currentElementId = relationship.spdxElementId;
  }

  return packageChain;
}

export function getPackageLevelName(document: IDocument, packageId: string): string {
  if (isPackageRootLevel(document, packageId)) {
    return 'Root';
  } else if (isPackageTopLevel(document, packageId)) {
    return 'Top';
  } else {
    return 'Transitive';
  }
}

export function isPackageRootLevel(document: IDocument, packageId: string): boolean {
  return document.documentDescribes.includes(packageId);
}

export function isPackageTopLevel(document: IDocument, packageId: string): boolean {
  const rootPackageIds = document.documentDescribes;
  const relationships = document.relationships || [];
  const dependsOnRelationships = relationships.filter((r) =>
    spdxConstantsAreEqual(r.relationshipType, RelationshipType.DependsOn),
  );
  return dependsOnRelationships.some(
    (relationship) =>
      rootPackageIds.includes(relationship.spdxElementId) &&
      relationship.relatedSpdxElement === packageId &&
      spdxConstantsAreEqual(relationship.relationshipType, RelationshipType.DependsOn),
  );
}

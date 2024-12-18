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

export function isPackageTopLevel(document: IDocument, packageId: string): boolean {
  const rootPackageIds = document.documentDescribes;
  const relationships = document.relationships || [];
  const dependsOnRelationships = relationships.filter((r) =>
    spdxConstantsAreEqual(r.relationshipType, RelationshipType.DependsOn),
  );
  return (
    rootPackageIds.includes(packageId) ||
    dependsOnRelationships.some(
      (relationship) =>
        rootPackageIds.includes(relationship.spdxElementId) &&
        relationship.relatedSpdxElement === packageId &&
        spdxConstantsAreEqual(relationship.relationshipType, RelationshipType.DependsOn),
    )
  );
}

export function getPackageDependsOnChain(document: IDocument, packageId: string): IPackage[] {
  const rootPackageIds = document.documentDescribes;
  const relationships = document.relationships || [];
  const dependsOnRelationships = relationships.filter((r) =>
    spdxConstantsAreEqual(r.relationshipType, RelationshipType.DependsOn),
  );
  const packages = (document.packages || []).filter((p) => {
    return !rootPackageIds.includes(p.SPDXID);
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

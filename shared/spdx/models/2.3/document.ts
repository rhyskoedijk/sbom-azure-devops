import { spdxConstantsAreEqual } from './constants';
import { ICreationInfo } from './creationInfo';
import { IFile } from './file';
import { IPackage } from './package';
import { IRelationship, RelationshipType } from './relationship';

import '../../../extensions/array';

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

export interface IPackageDependencyPath {
  dependencyPath: IPackage[];
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

export function getPackageAncestorDependencyPaths(document: IDocument, packageId: string): IPackageDependencyPath[] {
  const hasMultipleRootPackages = document.documentDescribes.length > 1;
  const rootPackageIds = document.documentDescribes;
  const relationships = document.relationships || [];
  const dependsOnRelationships = relationships.filter((r) =>
    spdxConstantsAreEqual(r.relationshipType, RelationshipType.DependsOn),
  );
  const packages = (document.packages || []).filter((p) => {
    return hasMultipleRootPackages || !rootPackageIds.includes(p.SPDXID);
  });

  const currentPackage = packages.find((p) => p.SPDXID === packageId);
  if (!currentPackage) {
    return [];
  }

  // Walk the dependency tree via all "DependsOn" relationships with the package to discover all possible package dependency paths
  const ancestorDependencyReleationships = dependsOnRelationships
    .filter((r: IRelationship) => r.relatedSpdxElement === packageId)
    .distinctBy((r: IRelationship) => r.spdxElementId + r.relatedSpdxElement);
  const ancestorDependencyPaths = ancestorDependencyReleationships.flatMap((relationship) =>
    getPackageAncestorPathsRecursive(dependsOnRelationships, packages, relationship.spdxElementId, [currentPackage], 1),
  );

  // Ensure there is only one ancestor dependency path per top-level package (prefer the longest path if multiple)
  const shortestUniqueAncestorDependencyPaths: Record<string, IPackageDependencyPath> = {};
  for (const path of ancestorDependencyPaths) {
    const topLevelPackage = path.dependencyPath[0];
    if (
      !shortestUniqueAncestorDependencyPaths[topLevelPackage.SPDXID] ||
      shortestUniqueAncestorDependencyPaths[topLevelPackage.SPDXID].dependencyPath.length < path.dependencyPath.length
    ) {
      shortestUniqueAncestorDependencyPaths[topLevelPackage.SPDXID] = path;
    }
  }

  return Object.values(shortestUniqueAncestorDependencyPaths);
}

function getPackageAncestorPathsRecursive(
  relationships: IRelationship[],
  packages: IPackage[],
  packageId: string,
  pathSoFar: IPackage[],
  depth: number,
): IPackageDependencyPath[] {
  const currentPackage = packages.find((p) => p.SPDXID === packageId);
  if (!currentPackage) {
    return [{ dependencyPath: pathSoFar }];
  }
  if (depth > 30) {
    console.warn(
      `Maximum depth of 30 reached while resolving package ancestor paths for '${pathSoFar.map((p) => p.name).join(' -> ')}'`,
    );
    return [{ dependencyPath: pathSoFar }];
  }

  const newPath = [currentPackage, ...pathSoFar].filter((p) => p !== undefined);
  const ancestorDependencyPaths: IPackageDependencyPath[] = [];
  const ancestorDependencyReleationships = relationships
    .filter((r: IRelationship) => r.relatedSpdxElement === packageId)
    .distinctBy((r: IRelationship) => r.spdxElementId + r.relatedSpdxElement);
  if (ancestorDependencyReleationships.length > 0) {
    for (const relationship of ancestorDependencyReleationships) {
      ancestorDependencyPaths.push(
        ...getPackageAncestorPathsRecursive(relationships, packages, relationship.spdxElementId, newPath, depth + 1),
      );
    }
  } else {
    ancestorDependencyPaths.push({ dependencyPath: newPath });
  }

  return ancestorDependencyPaths;
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

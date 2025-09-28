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
    getPackageAncestorPathsIterative(dependsOnRelationships, packages, relationship.spdxElementId, [currentPackage], 1),
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

function getPackageAncestorPathsIterative(
  relationships: IRelationship[],
  packages: IPackage[],
  packageId: string,
  pathSoFar: IPackage[],
  depth: number,
): IPackageDependencyPath[] {
  const stack: Array<{
    packageId: string;
    path: IPackage[];
    depth: number;
  }> = [{ packageId, path: pathSoFar, depth }];

  const results: IPackageDependencyPath[] = [];

  while (stack.length > 0) {
    const { packageId: currentId, path, depth: currentDepth } = stack.pop()!;
    const currentPackage = packages.find((p) => p.SPDXID === currentId);

    if (!currentPackage) {
      results.push({ dependencyPath: path });
      continue;
    }

    if (currentDepth > 30) {
      console.warn(
        `Maximum depth of 30 reached while resolving package ancestor paths for '${path.map((p) => p.name).join(' -> ')}'`,
      );
      results.push({ dependencyPath: path });
      continue;
    }

    const newPath = [currentPackage, ...path].filter((p) => p !== undefined);
    const ancestorDependencyRelationships = relationships
      .filter((r: IRelationship) => r.relatedSpdxElement === currentId)
      .distinctBy((r: IRelationship) => r.spdxElementId + r.relatedSpdxElement);

    if (ancestorDependencyRelationships.length > 0) {
      for (const relationship of ancestorDependencyRelationships) {
        stack.push({
          packageId: relationship.spdxElementId,
          path: newPath,
          depth: currentDepth + 1,
        });
      }
    } else {
      results.push({ dependencyPath: newPath });
    }
  }

  return results;
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

import path from 'path';
import { getCreatorOrganization } from '../models/spdx/2.3/ICreationInfo';
import { DocumentVersion, IDocument } from '../models/spdx/2.3/IDocument';
import { IPackage } from '../models/spdx/2.3/IPackage';

/**
 * Merge multiple SPDX documents to a single SPDX document
 * @param packageName The name of the merged ackage
 * @param packageVersion The version of the merged package
 * @param sourceDocuments The source SPDX documents to be merged
 * @return The merged SPDX document
 */
export function mergeSpdxDocuments(
  packageName: string | undefined,
  packageVersion: string | undefined,
  sourceDocuments: IDocument[],
): IDocument {
  const packageGuid = crypto.randomUUID();
  const rootDocument = sourceDocuments[0];
  const rootNamespaceUri = new URL(rootDocument.documentNamespace);
  const rootOrganisation = getCreatorOrganization(rootDocument.creationInfo);
  sourceDocuments.forEach((doc) => {
    renamePackageId(
      doc,
      'SPDXRef-RootPackage',
      (p) => `SPDXRef-Package-${p.name.replace(/[ ]/g, '')}-${crypto.randomUUID()}`,
    );
  });
  return {
    SPDXID: 'SPDXRef-DOCUMENT',
    spdxVersion: DocumentVersion.SPDX_2_3,
    name: `${packageName} ${packageVersion}`.trim(),
    dataLicense: rootDocument.dataLicense || 'CC0-1.0',
    documentNamespace: `${rootNamespaceUri.protocol}//${rootNamespaceUri.host}/${packageName}/${packageVersion}/${packageGuid}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: [`Organization: ${rootOrganisation}`, `Tool: rhyskoedijk/sbom-azure-devops-1.0`],
    },
    files: sourceDocuments.flatMap((d) =>
      d.files.map((f) => ({
        ...f,
        fileName: path.join(d.packages.find((p) => p.SPDXID == d.documentDescribes[0])?.name || '', f.fileName),
      })),
    ),
    packages: sourceDocuments.flatMap((d) => d.packages).distinctBy((p) => p.SPDXID),
    externalDocumentRefs: sourceDocuments.flatMap((d) => d.externalDocumentRefs),
    relationships: sourceDocuments.flatMap((d) => d.relationships),
    documentDescribes: sourceDocuments.flatMap((d) => d.documentDescribes),
  };
}

function renamePackageId(document: IDocument, packageId: string, packageIdBuilder: (p: IPackage) => string): IDocument {
  const pkg = document.packages.find((p) => document.documentDescribes.includes(p.SPDXID));
  if (pkg) {
    const oldId = pkg.SPDXID;
    const newId = packageIdBuilder(pkg);
    pkg.SPDXID = newId;
    document.documentDescribes = document.documentDescribes.map((id) => (id == oldId ? newId : id));
    document.relationships.forEach((r) => {
      if (r.spdxElementId == oldId) {
        r.spdxElementId = newId;
      }
      if (r.relatedSpdxElement == oldId) {
        r.relatedSpdxElement = newId;
      }
    });
  }

  return document;
}

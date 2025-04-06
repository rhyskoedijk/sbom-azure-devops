import md5 from 'md5';

import { getCreatorOrganization } from '../spdx/models/2.3/creationInfo';
import { DocumentVersion, IDocument } from '../spdx/models/2.3/document';
import { IFile } from '../spdx/models/2.3/file';
import { IPackage } from '../spdx/models/2.3/package';

const SpdxRefPrefix = 'SPDXRef';
const SpdxDocumentId = `${SpdxRefPrefix}-DOCUMENT`;
const SpdxRootPackageId = `${SpdxRefPrefix}-RootPackage`;

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

  // Because each document likely has a "root package" with the same id, we first need to rename them to avoid conflicts
  sourceDocuments.forEach((doc) => {
    renamePackageId(
      doc,
      SpdxRootPackageId,
      (p) => `${SpdxRefPrefix}-Package-${p.name.replace(/[^a-zA-Z0-9]+/g, '')}-${crypto.randomUUID()}`,
    );
  });

  // Files with the same path will share the same SPDX ID, so we need to rename them to avoid conflicts
  sourceDocuments.forEach((doc) => {
    const namespaceHash = md5(doc.documentNamespace).substring(0, 10);
    doc.files.forEach((file) => {
      const packageName = doc.packages.find((p) => p.hasFiles?.includes(file.SPDXID))?.name;
      renameFileId(doc, file.SPDXID, (f) => {
        const oldPrefix = `${SpdxRefPrefix}-File-`;
        const newPrefix = `${SpdxRefPrefix}-File-${packageName?.replace(/[^a-zA-Z0-9]+/g, '') || namespaceHash}`;
        return f.SPDXID.startsWith(newPrefix) ? f.SPDXID : f.SPDXID.replace(oldPrefix, newPrefix);
      });
    });
  });

  // Merge the documents
  return {
    SPDXID: SpdxDocumentId,
    spdxVersion: DocumentVersion.SPDX_2_3,
    name: `${packageName} ${packageVersion}`.trim(),
    dataLicense: rootDocument.dataLicense || 'CC0-1.0',
    documentNamespace: `${rootNamespaceUri.protocol}//${rootNamespaceUri.host}/${packageName}/${packageVersion}/${packageGuid}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: [`Organization: ${rootOrganisation}`, `Tool: rhyskoedijk/sbom-azure-devops`],
    },
    files: sourceDocuments.flatMap((d) => d.files),
    packages: sourceDocuments.flatMap((d) => d.packages).distinctBy((p) => p.SPDXID),
    externalDocumentRefs: sourceDocuments.flatMap((d) => d.externalDocumentRefs),
    relationships: sourceDocuments.flatMap((d) => d.relationships),
    documentDescribes: sourceDocuments.flatMap((d) => d.documentDescribes),
  };
}

/**
 * Rename the package ID in the SPDX document
 * @param document The SPDX document
 * @param packageId The package ID to be renamed
 * @param packageIdBuilder The function to build the new package ID
 * @returns The SPDX document with the renamed package ID
 */
function renamePackageId(document: IDocument, packageId: string, packageIdBuilder: (p: IPackage) => string): IDocument {
  // Find the package
  const pkg = document.packages.find((p) => p.SPDXID === packageId);
  if (pkg) {
    // Rename the package
    const oldId = pkg.SPDXID;
    const newId = packageIdBuilder(pkg);
    pkg.SPDXID = newId;

    // Update all references to the package
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

/**
 * Rename the file ID in the SPDX document
 * @param document The SPDX document
 * @param fileId The file ID to be renamed
 * @param fileIdBuilder The function to build the new file ID
 * @returns The SPDX document with the renamed file ID
 */
function renameFileId(document: IDocument, fileId: string, fileIdBuilder: (p: IFile) => string): IDocument {
  // Find the file
  const file = document.files.find((p) => p.SPDXID === fileId);
  if (file) {
    // Rename the file
    const oldId = file.SPDXID;
    const newId = fileIdBuilder(file);
    file.SPDXID = newId;

    // Update all references to the file
    document.packages.forEach((p) => {
      if (p.hasFiles?.includes(oldId)) {
        p.hasFiles = p.hasFiles.map((id) => (id == oldId ? newId : id));
      }
    });
  }

  return document;
}

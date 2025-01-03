import path from 'path';
import { getCreatorOrganization } from '../models/spdx/2.3/ICreationInfo';
import { DocumentVersion, IDocument } from '../models/spdx/2.3/IDocument';

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
    packages: sourceDocuments.flatMap((d) => d.packages),
    externalDocumentRefs: sourceDocuments.flatMap((d) => d.externalDocumentRefs),
    relationships: sourceDocuments.flatMap((d) => d.relationships),
    documentDescribes: sourceDocuments.flatMap((d) => d.documentDescribes),
  };
}

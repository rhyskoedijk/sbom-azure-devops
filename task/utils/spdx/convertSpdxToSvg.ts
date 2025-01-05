import { EOL } from 'os';
import * as path from 'path';

// `getrandom` does not directly support ES Modules running on Node.js.
// However, we can get it to work by adding a shim to the Web Cryptography API:
// See: https://docs.rs/getrandom/latest/getrandom/#nodejs-es-module-support
import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

// Vizdom must be imported AFTER the getrandom shim above, else it will throw an error
import { DirectedGraph, EdgeStyle, Shape, VertexWeakRef } from '@vizdom/vizdom-ts-node';

import { SecurityAdvisorySeverity } from '../../../shared/ghsa/ISecurityAdvisory';

import { NOASSERTION } from '../../../shared/models/spdx/2.3/Constants';
import { IDocument } from '../../../shared/models/spdx/2.3/IDocument';
import { ExternalRefCategory, ExternalRefSecurityType } from '../../../shared/models/spdx/2.3/IExternalRef';

const VERTEX_DOC_FILL_COLOR = '#E0E0E0';
const VERTEX_PKG_FILL_COLOR = '#E0E0E0';
const VERTEX_REF_FILL_COLOR = '#FAFAFA';
const VERTEX_FILE_FILL_COLOR = '#E0E0E0';
const VERTEX_CRITICAL_FILL_COLOR = '#E57373';
const VERTEX_HIGH_FILL_COLOR = '#FF8A65';
const VERTEX_MODERATE_FILL_COLOR = '#FFB74D';
const VERTEX_LOW_FILL_COLOR = '#64B5F6';

/**
 * Convert an SPDX document to SVG graph diagram
 * @param spdxJson The SPDX document
 * @return The SPDX as SVG buffer
 */
export async function convertSpdxToSvgAsync(spdx: IDocument): Promise<Buffer> {
  // Create a new graph
  const graph = new DirectedGraph();
  const vertices = new Map<string, VertexWeakRef>();

  // Create a vertex for the document itself
  console.info(`Generating graph vertex for document root`);
  const spdxProperties = [
    `SPDX Version: ${spdx.spdxVersion || NOASSERTION}`,
    `Data License: ${spdx.dataLicense || NOASSERTION}`,
  ];
  vertices.set(
    spdx.SPDXID,
    graph.new_vertex({
      render: {
        shape: Shape.Circle,
        label: spdx.name,
        tooltip: ((spdx.creationInfo?.creators as string[]) || []).concat(spdxProperties).join(EOL),
        fill_color: VERTEX_DOC_FILL_COLOR,
      },
    }),
  );

  // Create vertices for each package
  console.info(`Generating graph vertices and edges for ${spdx.packages?.length || 0} packages`);
  for (const pkg of spdx.packages) {
    const pkgProperties = [`${pkg.supplier}`, `License: ${pkg.licenseConcluded || pkg.licenseDeclared || NOASSERTION}`];
    const pkgVertex = graph.new_vertex({
      render: {
        label: `${pkg.name} v${pkg.versionInfo}`,
        tooltip: pkgProperties.join(EOL),
        fill_color: VERTEX_PKG_FILL_COLOR,
      },
    });

    vertices.set(pkg.SPDXID, pkgVertex);

    // Create vertices and edges for each file contained in the package
    if (pkg.hasFiles) {
      for (const fileId of pkg.hasFiles) {
        const file = (spdx.files as any[]).find((f) => f.SPDXID === fileId);
        graphFileAndParentDirectoriesRecursive(file, graph, vertices, pkgVertex);
      }
    }

    // Create vertices and edges for each external reference in the package
    if (pkg.externalRefs) {
      for (const externalRef of pkg.externalRefs) {
        let referenceVertex = vertices.get(externalRef.referenceLocator);
        if (referenceVertex === undefined) {
          let referenceId = externalRef.referenceLocator;
          let referenceProperties = undefined;
          let referenceUrl = undefined;
          let referenceShape = undefined;
          let referenceFillColour = VERTEX_REF_FILL_COLOR;
          switch (externalRef.referenceCategory) {
            case ExternalRefCategory.PackageManager:
              continue;
            case ExternalRefCategory.Security:
              const advisory = parseSecurityAdvisory(externalRef);
              if (!advisory) {
                continue;
              }
              referenceId = `${advisory.cveId || advisory.ghsaId || externalRef.referenceLocator} [${advisory.severity}]`;
              referenceProperties = [
                `CVE: ${advisory.cveId || NOASSERTION}`,
                `GHSA: ${advisory.ghsaId || NOASSERTION}`,
                `Severity: ${advisory.severity || NOASSERTION}`,
                `Summary: ${advisory.summary || NOASSERTION}`,
              ];
              referenceUrl = externalRef.referenceLocator;
              referenceShape = Shape.Diamond;
              switch (advisory.severity) {
                case SecurityAdvisorySeverity.Critical:
                  referenceFillColour = VERTEX_CRITICAL_FILL_COLOR;
                  break;
                case SecurityAdvisorySeverity.High:
                  referenceFillColour = VERTEX_HIGH_FILL_COLOR;
                  break;
                case SecurityAdvisorySeverity.Moderate:
                  referenceFillColour = VERTEX_MODERATE_FILL_COLOR;
                  break;
                case SecurityAdvisorySeverity.Low:
                  referenceFillColour = VERTEX_LOW_FILL_COLOR;
                  break;
              }
              break;
          }
          referenceVertex = graph.new_vertex({
            render: {
              label: referenceId,
              tooltip: referenceProperties?.join(EOL),
              url: referenceUrl,
              shape: referenceShape,
              fill_color: referenceFillColour,
            },
          });
          vertices.set(referenceId, referenceVertex);
        }
        if (referenceVertex) {
          graph.new_edge(pkgVertex, referenceVertex, {
            render: {
              label: normaliseEdgeLabel(`${externalRef.referenceCategory} ${externalRef.referenceType}`),
              style: EdgeStyle.Dashed,
            },
          });
        }
      }
    }
  }

  // Create edges for each relationship
  console.info(`Generating graph edges for ${spdx.relationships?.length || 0} relationships`);
  for (const relationship of spdx.relationships) {
    const sourceVertex = vertices.get(relationship.spdxElementId);
    const targetVertex = vertices.get(relationship.relatedSpdxElement);
    if (sourceVertex && targetVertex) {
      graph.new_edge(sourceVertex, targetVertex, {
        render: {
          label: normaliseEdgeLabel(relationship.relationshipType),
        },
      });
    }
  }

  // Position the graph
  const positioned = graph.layout();

  // Export the graph as SVG text
  console.info(`Writing SVG image`);
  return Buffer.from(positioned.to_svg().to_string(), 'utf8');
}

function graphFileAndParentDirectoriesRecursive(
  node: any,
  graph: DirectedGraph,
  vertices: Map<string, VertexWeakRef>,
  rootVertex: VertexWeakRef | undefined,
) {
  let nodeVertex: VertexWeakRef;
  const nodePath = path.normalize(node.fileName);
  const parentPath = nodePath.includes(path.sep) ? path.dirname(nodePath) : undefined;
  if (parentPath) {
    graphFileAndParentDirectoriesRecursive({ fileName: parentPath }, graph, vertices, rootVertex);
  }

  const isFile = node.SPDXID;
  if (!isFile) {
    if (vertices.get(nodePath)) {
      return;
    }

    // Create a vertex for the directory, if it doesn't already exist
    nodeVertex =
      vertices.get(nodePath) ||
      graph.new_vertex({
        render: {
          label: path.basename(nodePath),
          tooltip: 'Directory',
          fill_color: VERTEX_FILE_FILL_COLOR,
        },
      });

    vertices.set(nodePath, nodeVertex);
  } else {
    // Create a vertex for the file
    nodeVertex = graph.new_vertex({
      render: {
        label: path.basename(nodePath),
        tooltip: (node.checksums as any[])?.map((c) => `${c.algorithm}: ${c.checksumValue}`)?.join(EOL),
        fill_color: VERTEX_FILE_FILL_COLOR,
      },
    });

    vertices.set(node.SPDXID, nodeVertex);
  }

  // Create an edge to the parent directory vertex, if any
  const parentVertex = parentPath ? vertices.get(parentPath) : rootVertex;
  if (parentVertex && nodeVertex) {
    graph.new_edge(parentVertex, nodeVertex, {
      render: {
        label: normaliseEdgeLabel('CONTAINS'),
      },
    });
  }
}

function parseSecurityAdvisory(externalRef: any): any {
  if (
    externalRef.referenceCategory !== ExternalRefCategory.Security ||
    externalRef.referenceType !== ExternalRefSecurityType.Advisory
  ) {
    return undefined;
  }
  return {
    ghsaId: externalRef.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0],
    cveId: externalRef.comment?.match(/CVE-[0-9-]+/i)?.[0],
    severity: externalRef.comment?.match(/^\[(\w+)\]/)?.[1]?.toUpperCase(),
    summary: externalRef.comment?.match(/^\[(\w+)\](.*)$/)?.[2]?.trim(),
  };
}

function normaliseEdgeLabel(label: string): string {
  return label?.replace(/[_-]/g, ' ')?.toUpperCase()?.trim();
}

import { DirectedGraph, EdgeStyle, Shape, VertexWeakRef } from '@vizdom/vizdom-ts-node';
import { existsSync as fileExistsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

const NO_ASSERTION = 'NOASSERTION';
const VERTEX_DOC_FILL_COLOR = '#E0E0E0';
const VERTEX_PKG_FILL_COLOR = '#E0E0E0';
const VERTEX_REF_FILL_COLOR = '#FAFAFA';
const VERTEX_FILE_FILL_COLOR = '#E0E0E0';

/**
 * Graph SPDX file to an SVG file
 * @param spdxFilePath The path to the SPDX file
 */
export async function spdxGraphToSvgAsync(spdxFilePath: string): Promise<string> {
  if (!fileExistsSync(spdxFilePath)) {
    throw new Error(`SPDX file not found: ${spdxFilePath}`);
  }

  // Read the SPDX file
  const sbom = JSON.parse(await fs.readFile(spdxFilePath, 'utf-8'));
  const vertices = new Map<string, VertexWeakRef>();

  // Create a new graph
  const graph = new DirectedGraph();

  // Create a vertex for the document itself
  console.info(`Generating graph vertex for document root`);
  const sbomProperties = [
    `SPDX Version: ${sbom.spdxVersion || NO_ASSERTION}`,
    `Data License: ${sbom.dataLicense || NO_ASSERTION}`,
  ];
  vertices.set(
    sbom.SPDXID,
    graph.new_vertex({
      render: {
        shape: Shape.Circle,
        label: sbom.name,
        tooltip: ((sbom.creationInfo?.creators as string[]) || []).concat(sbomProperties).join('\n'),
        fill_color: VERTEX_DOC_FILL_COLOR,
      },
    }),
  );

  // Create vertices for each package
  console.info(`Generating graph vertices and edges for ${sbom.packages?.length || 0} packages`);
  for (const pkg of sbom.packages) {
    const pkgProperties = [
      `${pkg.supplier}`,
      `License: ${pkg.licenseConcluded || pkg.licenseDeclared || NO_ASSERTION}`,
    ];
    const pkgVertex = graph.new_vertex({
      render: {
        label: `${pkg.name} v${pkg.versionInfo}`,
        tooltip: pkgProperties.join('\n'),
        fill_color: VERTEX_PKG_FILL_COLOR,
      },
    });

    vertices.set(pkg.SPDXID, pkgVertex);

    // Create vertices and edges for each file contained in the package
    if (pkg.hasFiles) {
      for (const fileId of pkg.hasFiles) {
        const file = (sbom.files as any[]).find((f) => f.SPDXID === fileId);
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
            case 'PACKAGE-MANAGER':
              continue;
            case 'SECURITY':
              const advisory = parseSecurityAdvisory(externalRef);
              referenceId = `${advisory.cveId || advisory.ghsaId || externalRef.referenceLocator} [${advisory.severity}]`;
              referenceProperties = [
                `CVE: ${advisory.cveId || NO_ASSERTION}`,
                `GHSA: ${advisory.ghsaId || NO_ASSERTION}`,
                `Severity: ${advisory.severity || NO_ASSERTION}`,
                `Summary: ${advisory.summary || NO_ASSERTION}`,
              ];
              referenceUrl = externalRef.referenceLocator;
              referenceShape = Shape.Diamond;
              switch (advisory.severity) {
                case 'CRITICAL':
                  referenceFillColour = '#E57373';
                  break;
                case 'HIGH':
                  referenceFillColour = '#FF8A65';
                  break;
                case 'MODERATE':
                  referenceFillColour = '#FFB74D';
                  break;
                case 'LOW':
                  referenceFillColour = '#64B5F6';
                  break;
              }
              break;
          }
          referenceVertex = graph.new_vertex({
            render: {
              label: referenceId,
              tooltip: referenceProperties?.join('\n'),
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
  console.info(`Generating graph edges for ${sbom.relationships?.length || 0} relationships`);
  for (const relationship of sbom.relationships) {
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

  // Write the SVG file
  const svgFilePath = path.format({ ...path.parse(spdxFilePath), base: '', ext: '.svg' });
  console.info(`Exporting graph to SVG file: '${svgFilePath}'`);
  await fs.writeFile(svgFilePath, positioned.to_svg().to_string(), 'utf-8');
  return svgFilePath;
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
        tooltip: (node.checksums as any[])?.map((c) => `${c.algorithm}: ${c.checksumValue}`)?.join('\n'),
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

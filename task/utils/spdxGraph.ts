import { DirectedGraph, Shape, VertexWeakRef } from '@vizdom/vizdom-ts-node';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Convert an SPDX file to an SVG file
 * @param spdxFilePath The path to the SPDX file
 */
export function spdxToSvg(spdxFilePath: string) {
  if (!fs.existsSync(spdxFilePath)) {
    throw new Error(`SPDX file not found: ${spdxFilePath}`);
  }

  const sbom = JSON.parse(fs.readFileSync(spdxFilePath, 'utf-8'));
  const vertices = new Map<string, VertexWeakRef>();

  // Create a new graph
  const graph = new DirectedGraph();

  // Create a vertex for the SBOM document itself
  vertices.set(
    sbom.SPDXID,
    graph.new_vertex({
      render: {
        shape: Shape.Circle,
        label: sbom.name,
        tooltip: [`SPDX Version: ${sbom.spdxVersion}`, `Data License: ${sbom.dataLicense}`]
          .concat((sbom.creationInfo?.creators as string[]) || [])
          .join('\n'),
      },
    }),
  );

  // Create vertices for each file
  for (const sbomFile of sbom.files) {
    vertices.set(
      sbomFile.SPDXID,
      graph.new_vertex({
        render: {
          label: sbomFile.fileName,
          tooltip: (sbomFile.checksums as any[]).map((c) => `${c.algorithm}: ${c.checksumValue}`).join('\n'),
        },
      }),
    );
  }

  // Create vertices for each package
  for (const sbomPackage of sbom.packages) {
    const packageProperties = [
      `License: ${sbomPackage.licenseConcluded || sbomPackage.licenseDeclared}`,
      `${sbomPackage.supplier}`,
    ];
    const packageVertex = graph.new_vertex({
      render: {
        label: `${sbomPackage.name} v${sbomPackage.versionInfo}`,
        tooltip: packageProperties.join('\n'),
      },
    });

    // Create edges for each file contained in the package
    vertices.set(sbomPackage.SPDXID, packageVertex);
    if (sbomPackage.hasFiles) {
      for (const file of sbomPackage.hasFiles) {
        const fileVertex = vertices.get(file);
        if (fileVertex) {
          graph.new_edge(packageVertex, fileVertex, {
            render: {
              label: 'CONTAINS',
            },
          });
        }
      }
    }

    // Create edges for each external reference
    if (sbomPackage.externalRefs) {
      for (const externalRef of sbomPackage.externalRefs) {
        const referenceId = externalRef.referenceLocator.split('/')[0];
        let referenceVertex = vertices.get(referenceId);
        if (referenceVertex === undefined) {
          referenceVertex = graph.new_vertex({
            render: {
              label: referenceId,
              shape: Shape.Square,
            },
          });
          vertices.set(referenceId, referenceVertex);
        }
        if (referenceVertex) {
          graph.new_edge(packageVertex, referenceVertex, {
            render: {
              label: externalRef.referenceCategory,
            },
          });
        }
      }
    }
  }

  // Create edges for each relationship
  for (const relationship of sbom.relationships) {
    const sourceVertex = vertices.get(relationship.spdxElementId);
    const targetVertex = vertices.get(relationship.relatedSpdxElement);
    if (sourceVertex && targetVertex) {
      graph.new_edge(sourceVertex, targetVertex, {
        render: {
          label: relationship.relationshipType,
          tooltip: relationship.relationshipType,
        },
      });
    }
  }

  // Position the graph
  const positioned = graph.layout();

  // Finally, obtain to an SVG
  fs.writeFileSync(
    path.format({ ...path.parse(spdxFilePath), base: '', ext: '.svg' }),
    positioned.to_svg().to_string(),
  );
}

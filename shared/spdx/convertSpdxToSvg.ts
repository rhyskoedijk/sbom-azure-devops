import { IDocument } from '../spdx/models/2.3/document';

/**
 * Convert an SPDX document to SVG graph diagram
 * @param spdx The SPDX document
 * @return The SPDX as SVG buffer
 */
export async function convertSpdxToSvgAsync(spdx: IDocument): Promise<Buffer> {
  // TODO: Implement this from task/ulils/spdx/convertSpdxToSvg.ts
  throw new Error('Not implemented');
}

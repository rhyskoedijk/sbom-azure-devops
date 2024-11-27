import { IDocument } from './spdx/2.3/IDocument';

export interface ISbomBuildArtifact {
  spdxDocument: IDocument;
  xlsxDocument: ArrayBuffer | undefined;
  svgDocument: ArrayBuffer | undefined;
}

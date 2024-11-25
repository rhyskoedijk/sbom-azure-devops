import { IDocument } from './spdx/2.2/IDocument';

export interface ISbomBuildArtifact {
  spdxDocument: IDocument;
  xlsxDocument: ArrayBuffer | undefined;
  svgDocument: ArrayBuffer | undefined;
}

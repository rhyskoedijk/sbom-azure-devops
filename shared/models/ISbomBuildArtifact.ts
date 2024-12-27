import { IDocument } from './spdx/2.3/IDocument';

export interface ISbomBuildArtifact {
  id: string;
  spdxDocument: IDocument;
  xlsxDocument?: ArrayBuffer;
  svgDocument?: ArrayBuffer;
}

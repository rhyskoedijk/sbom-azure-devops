import { IDocument } from './spdx/2.3/IDocument';

export interface ISbomBuildArtifact {
  id: string;
  spdxDocument: IDocument;
  spdxJsonDocument: ArrayBuffer;
  loadSvgDocumentAsync?: () => Promise<ArrayBuffer>;
}

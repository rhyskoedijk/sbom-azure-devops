import { IDocument } from '../spdx/models/2.3/document';

export interface ISbomBuildArtifact {
  id: string;
  spdxDocument: IDocument;
  spdxJsonDocument: ArrayBuffer;
  loadSvgDocumentAsync?: () => Promise<ArrayBuffer>;
}

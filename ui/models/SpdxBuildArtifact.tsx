import { ISpdx22Document } from './Spdx22Document';

export interface ISpdxBuildArtifact {
  spdxDocument: ISpdx22Document;
  xlsxDocument: ArrayBuffer | undefined;
  svgDocument: ArrayBuffer | undefined;
}

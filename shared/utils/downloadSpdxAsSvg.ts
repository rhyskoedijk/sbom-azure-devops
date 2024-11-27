import { IDocument } from '../models/spdx/2.3/IDocument';

export function downloadSpdxAsSvg(doc: IDocument, svg: ArrayBuffer): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const elem = window.document.createElement('a');
  try {
    elem.href = window.URL.createObjectURL(blob);
    elem.download = `${doc.name}.spdx.svg`;
    document.body.appendChild(elem);
    elem.click();
  } finally {
    document.body.removeChild(elem);
  }
}

import { ISpdx22Document } from '../models/Spdx22Document';

export function downloadSpdxAsSvg(doc: ISpdx22Document, svg: ArrayBuffer): void {
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

import { ISpdx22Document } from '../models/Spdx22';

export function downloadSpdxAsSvg(doc: ISpdx22Document): void {
  if (!doc.documentGraphSvg) {
    alert('TODO: Implement SVG generation');
  }

  const blob = new Blob([doc.documentGraphSvg || ''], { type: 'image/svg+xml' });
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

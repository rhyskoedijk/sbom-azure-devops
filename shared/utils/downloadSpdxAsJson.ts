import { IDocument } from '../models/spdx/2.2/IDocument';

export function downloadSpdxAsJson(doc: IDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'text/json' });
  const elem = window.document.createElement('a');
  try {
    elem.href = window.URL.createObjectURL(blob);
    elem.download = `${doc.name}.spdx.json`;
    document.body.appendChild(elem);
    elem.click();
  } finally {
    document.body.removeChild(elem);
  }
}

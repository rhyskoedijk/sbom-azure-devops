import * as fs from 'fs';

import { expect } from '@jest/globals';

import { getPackageAncestorDependencyPaths, IDocument } from './document';

describe('getPackageAncestorDependencyPaths', () => {
  const document = JSON.parse(fs.readFileSync('tests/spdx/manifest.spdx.json', 'utf-8')) as IDocument;

  it('should return an empty array if the package is not found', () => {
    const result = getPackageAncestorDependencyPaths(document, 'SPDXRef-NonExistentPackage');
    expect(result).toEqual([]);
  });

  it('should return an empty array if the package has no ancestors', () => {
    const result = getPackageAncestorDependencyPaths(document, 'SPDXRef-RootPackage');
    expect(result).toEqual([]);
  });

  it('should return the correct dependency path for a package with ancestors', () => {
    const targetPackage = document.packages.find((p) => p.name === 'Microsoft.Identity.Web')?.SPDXID || '';
    const result = getPackageAncestorDependencyPaths(document, targetPackage);
    expect(result).toMatchObject([
      { dependencyPath: [{ name: 'Microsoft.Identity.Web.UI' }, { name: 'Microsoft.Identity.Web' }] },
    ]);
  });
});

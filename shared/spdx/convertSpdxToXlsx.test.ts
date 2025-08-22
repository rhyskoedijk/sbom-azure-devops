import { expect, jest } from '@jest/globals';
import { Buffer } from 'buffer';
import { convertSpdxToXlsxAsync } from './convertSpdxToXlsx';

// Mocks for dependencies
jest.mock('../models/severity', () => ({
  getSeverityByName: jest.fn(() => ({ weight: 1 })),
}));
jest.mock('../spdx/models/2.3/checksum', () => ({
  ChecksumAlgorithm: { SHA256: 'SHA256' },
  getChecksum: jest.fn(() => 'dummychecksum'),
}));
jest.mock('../spdx/models/2.3/creationInfo', () => ({
  getCreatorOrganization: jest.fn(() => 'TestOrg'),
  getCreatorTool: jest.fn(() => 'TestTool'),
}));
jest.mock('../spdx/models/2.3/document', () => ({
  getPackageAncestorDependencyPaths: jest.fn(() => []),
  getPackageLevelName: jest.fn(() => 'library'),
}));
jest.mock('../spdx/models/2.3/externalRef', () => ({
  ExternalRefCategory: { Security: 'Security' },
  ExternalRefSecurityType: { Url: 'Url' },
  getExternalRefPackageManagerName: jest.fn(() => 'npm'),
  getExternalRefPackageManagerUrl: jest.fn(() => 'https://npmjs.com/package/test'),
  parseExternalRefsAs: jest.fn(() => []),
}));
jest.mock('../spdx/models/2.3/license', () => ({
  getLicensesFromExpression: jest.fn(() => [{ id: 'MIT', name: 'MIT', url: 'https://opensource.org/licenses/MIT' }]),
}));
jest.mock('../spdx/models/2.3/package', () => ({
  getPackageLicenseExpression: jest.fn(() => 'MIT'),
  getPackageLicenseReferences: jest.fn(() => ['MIT']),
  getPackageSupplierOrganization: jest.fn(() => 'TestSupplier'),
}));
jest.mock('./parseSpdxLegacySecurityAdvisories', () => ({
  parseSpdxLegacySecurityAdvisories: jest.fn(() => []),
}));
jest.mock('../ghsa/models/license', () => ({
  getLicenseRiskAssessment: jest.fn(() => ({ severity: 'Low', reasons: ['Permissive'] })),
  LicenseRiskSeverity: { Low: 'Low' },
}));
jest.mock('../ghsa/models/securityAdvisory', () => ({
  SecurityAdvisoryIdentifierType: { Ghsa: 'Ghsa', Cve: 'Cve' },
  SecurityAdvisorySeverity: {
    Critical: 'Critical',
    High: 'High',
    Moderate: 'Moderate',
    Low: 'Low',
  },
}));

describe('convertSpdxToXlsxAsync', () => {
  it('should generate an XLSX buffer for a minimal SPDX document', async () => {
    const spdx = {
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'TestDoc',
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      creationInfo: { created: '2024-01-01T00:00:00Z' },
      documentNamespace: 'http://spdx.org/spdxdocs/test',
      documentDescribes: ['SPDXRef-Package'],
      relationships: [],
      files: [
        {
          SPDXID: 'SPDXRef-File',
          fileName: 'src/index.js',
          checksums: [{ algorithm: 'SHA256', checksumValue: 'abc123' }],
        },
      ],
      packages: [
        {
          SPDXID: 'SPDXRef-Package',
          name: 'test-package',
          versionInfo: '1.0.0',
          externalRefs: [],
          hasFiles: ['SPDXRef-File'],
        },
      ],
    };

    const buffer = await convertSpdxToXlsxAsync(spdx as any);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle empty files, packages, relationships, and suppliers', async () => {
    const spdx = {
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'EmptyDoc',
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      creationInfo: { created: '2024-01-01T00:00:00Z' },
      documentNamespace: '',
      documentDescribes: [],
      relationships: [],
      files: [],
      packages: [],
    };

    const buffer = await convertSpdxToXlsxAsync(spdx as any);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should include license and supplier information in the sheets', async () => {
    const spdx = {
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'LicenseSupplierDoc',
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      creationInfo: { created: '2024-01-01T00:00:00Z' },
      documentNamespace: 'http://spdx.org/spdxdocs/test',
      documentDescribes: ['SPDXRef-Package'],
      relationships: [],
      files: [],
      packages: [
        {
          SPDXID: 'SPDXRef-Package',
          name: 'test-package',
          versionInfo: '1.0.0',
          externalRefs: [],
          hasFiles: [],
        },
      ],
    };

    const buffer = await convertSpdxToXlsxAsync(spdx as any);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should not throw error if package name is longer than 32767 characters', async () => {
    const longPackageName = 'a'.repeat(32768);
    const spdx = {
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'LongPackageNameDoc',
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      creationInfo: { created: '2024-01-01T00:00:00Z' },
      documentNamespace: 'http://spdx.org/spdxdocs/test',
      documentDescribes: ['SPDXRef-Package'],
      relationships: [],
      files: [],
      packages: [
        {
          SPDXID: 'SPDXRef-Package',
          name: longPackageName,
          versionInfo: '1.0.0',
          externalRefs: [],
          hasFiles: [],
        },
      ],
    };

    const buffer = await convertSpdxToXlsxAsync(spdx as any);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

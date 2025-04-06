import * as Path from 'path';

import { IJsonSheet } from 'json-as-xlsx';

import { getSeverityByName } from '../models/severity';
import { ChecksumAlgorithm, getChecksum } from '../spdx/models/2.3/checksum';
import { getCreatorOrganization, getCreatorTool } from '../spdx/models/2.3/creationInfo';
import { getPackageAncestorDependencyPaths, getPackageLevelName, IDocument } from '../spdx/models/2.3/document';
import {
  ExternalRefCategory,
  ExternalRefSecurityType,
  getExternalRefPackageManagerName,
  getExternalRefPackageManagerUrl,
  parseExternalRefsAs,
} from '../spdx/models/2.3/externalRef';
import { IFile } from '../spdx/models/2.3/file';
import { getLicensesFromExpression, ILicense } from '../spdx/models/2.3/license';
import {
  getPackageLicenseExpression,
  getPackageLicenseReferences,
  getPackageSupplierOrganization,
  IPackage,
} from '../spdx/models/2.3/package';
import { IRelationship } from '../spdx/models/2.3/relationship';
import { parseSpdxLegacySecurityAdvisories } from './parseSpdxLegacySecurityAdvisories';

import { getLicenseRiskAssessment, LicenseRiskSeverity } from '../ghsa/models/license';
import { SecurityAdvisoryIdentifierType, SecurityAdvisorySeverity } from '../ghsa/models/securityAdvisory';
import { ISecurityVulnerability } from '../ghsa/models/securityVulnerability';

import '../extensions/array';

/**
 * Convert an SPDX document to XLSX spreadsheet
 * @param spdx The SPDX document
 * @return The SPDX as XLSX buffer
 */
export async function convertSpdxToXlsxAsync(spdx: IDocument): Promise<Buffer> {
  console.info('Parising SPDX document objects');
  const relationships = spdx.relationships || [];
  const files = spdx.files || [];
  const packages = spdx.packages || [];
  const securityAdvisories = packages
    .flatMap(
      (pkg: IPackage) =>
        parseExternalRefsAs<ISecurityVulnerability>(
          pkg.externalRefs || [],
          ExternalRefCategory.Security,
          ExternalRefSecurityType.Url,
        ) ||
        parseSpdxLegacySecurityAdvisories(pkg) ||
        [],
    )
    .filter((vuln): vuln is ISecurityVulnerability => !!vuln && !!vuln.package && !!vuln.advisory)
    .distinctBy((vuln: ISecurityVulnerability) => vuln.advisory.permalink);
  const licenses = packages
    .map((pkg) => getPackageLicenseExpression(pkg))
    .distinct()
    .filter((licenseExpression): licenseExpression is string => !!licenseExpression)
    .flatMap((licenseExpression: string) => getLicensesFromExpression(licenseExpression))
    .filter((license): license is ILicense => !!license)
    .distinctBy((license: ILicense) => license.id);
  const suppliers = packages
    .map((pkg) => getPackageSupplierOrganization(pkg))
    .filter((supplier): supplier is string => !!supplier)
    .distinct();

  /**
   * Document sheet
   */
  console.info('Generating document sheet');
  const documentSheet: IJsonSheet = {
    sheet: 'Document',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Created', value: 'created' },
      { label: 'Creator', value: 'organization' },
      { label: 'Tool', value: 'tool' },
      { label: 'SPDX Version', value: 'spdxVersion' },
      { label: 'Data License', value: 'dataLicense' },
      { label: 'Namespace', value: 'namespace' },
      { label: 'Describes', value: 'describes' },
    ],
    content: [
      {
        id: spdx.SPDXID,
        name: spdx.name,
        spdxVersion: spdx.spdxVersion,
        dataLicense: spdx.dataLicense,
        created: new Date(spdx.creationInfo.created).toLocaleString(),
        organization: getCreatorOrganization(spdx.creationInfo) || '',
        tool: getCreatorTool(spdx.creationInfo) || '',
        namespace: spdx.documentNamespace || '',
        describes: spdx.documentDescribes.join(', ') || '',
      },
    ],
  };

  /**
   * Files sheet
   */
  console.info(`Generating files sheet for ${files.length} row(s)`);
  const filesSheet: IJsonSheet = {
    sheet: 'Files',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Package', value: 'package' },
      { label: 'File Name', value: 'name' },
      { label: 'Checksum (SHA256)', value: 'checksum' },
    ],
    content: files
      .orderBy((file: IFile) => file.SPDXID)
      .map((file: IFile) => {
        return {
          id: file.SPDXID,
          package: packages.find((p) => p.hasFiles?.includes(file.SPDXID))?.name || '',
          name: Path.normalize(file.fileName),
          checksum: getChecksum(file.checksums, ChecksumAlgorithm.SHA256) || '',
        };
      }),
  };

  /**
   * Packages sheet
   */
  console.info(`Generating packages sheet for ${packages.length} row(s)`);
  const packagesSheet: IJsonSheet = {
    sheet: 'Packages',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Version', value: 'version' },
      { label: 'Package Manager', value: 'packageManagerName' },
      { label: 'Package URL', value: 'packageManagerUrl' },
      { label: 'Type', value: 'type' },
      { label: 'Ancestor Package Paths', value: 'ancestorDependencyPaths' },
      { label: 'License', value: 'license' },
      { label: 'Supplier', value: 'supplier' },
      { label: 'Total Vulnerabilities', value: 'totalVulnerabilities' },
      { label: 'Critical Vulnerabilities', value: 'criticalVulnerabilities' },
      { label: 'High Vulnerabilities', value: 'highVulnerabilities' },
      { label: 'Moderate Vulnerabilities', value: 'moderateVulnerabilities' },
      { label: 'Low Vulnerabilities', value: 'lowVulnerabilities' },
      { label: 'Security Advisories', value: 'securityAdvisories' },
    ],
    content: packages
      .orderBy((pkg: IPackage) => pkg.name)
      .map((pkg: IPackage) => {
        const securityAdvisories =
          parseExternalRefsAs<ISecurityVulnerability>(
            pkg.externalRefs || [],
            ExternalRefCategory.Security,
            ExternalRefSecurityType.Url,
          ) ||
          parseSpdxLegacySecurityAdvisories(pkg) ||
          [];
        return {
          id: pkg.SPDXID,
          name: pkg.name,
          version: pkg.versionInfo,
          packageManagerName: getExternalRefPackageManagerName(pkg.externalRefs) || '',
          packageManagerUrl: getExternalRefPackageManagerUrl(pkg.externalRefs) || '',
          type: getPackageLevelName(spdx, pkg.SPDXID) || '',
          ancestorDependencyPaths:
            getPackageAncestorDependencyPaths(spdx, pkg.SPDXID)
              .map((p) => p.dependencyPath.map((p) => p.name).join(' > '))
              .join(', ') || '',
          license: getPackageLicenseExpression(pkg) || '',
          supplier: getPackageSupplierOrganization(pkg) || '',
          totalVulnerabilities: securityAdvisories.length,
          criticalVulnerabilities: securityAdvisories.filter(
            (a) => a.advisory?.severity === SecurityAdvisorySeverity.Critical,
          ).length,
          highVulnerabilities: securityAdvisories.filter((a) => a.advisory?.severity === SecurityAdvisorySeverity.High)
            .length,
          moderateVulnerabilities: securityAdvisories.filter(
            (a) => a.advisory?.severity === SecurityAdvisorySeverity.Moderate,
          ).length,
          lowVulnerabilities: securityAdvisories.filter((a) => a.advisory?.severity === SecurityAdvisorySeverity.Low)
            .length,
          securityAdvisories:
            securityAdvisories
              .map((a) => a.advisory?.identifiers?.find((i) => i.type == SecurityAdvisoryIdentifierType.Ghsa)?.value)
              .join(', ') || '',
        };
      }),
  };

  /**
   * Security advisories sheet
   */
  console.info(`Generating security advisories sheet for ${packages.length} row(s)`);
  const securityAdvisoriesSheet: IJsonSheet = {
    sheet: 'Security Advisories',
    columns: [
      { label: 'GHSA ID', value: 'ghsaId' },
      { label: 'CVE ID', value: 'cveId' },
      { label: 'Summary', value: 'summary' },
      { label: 'Package', value: 'package' },
      { label: 'Vulnerable Versions', value: 'vulnerableVersionRange' },
      { label: 'Fix Available', value: 'fixAvailable' },
      { label: 'Fixed In', value: 'firstPatchedVersion' },
      { label: 'Severity', value: 'severity' },
      { label: 'CVSS Score', value: 'cvssScore' },
      { label: 'CVSS Vector', value: 'cvssVector' },
      { label: 'EPSS Percentage', value: 'epssPercentage' },
      { label: 'EPSS Percentile', value: 'epssPercentile' },
      { label: 'Weaknesses', value: 'cweIds' },
      { label: 'Published On', value: 'publishedAt' },
      { label: 'URL', value: 'permalink' },
    ],
    content: securityAdvisories
      .orderBy((vuln: ISecurityVulnerability) => getSeverityByName(vuln.advisory.severity).weight, false)
      .map((vuln: ISecurityVulnerability) => {
        const packageSpdxId = packages?.find(
          (p) => p.name == vuln.package.name && p.versionInfo == vuln.package.version,
        )?.SPDXID;
        return {
          ghsaId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Ghsa)?.value || '',
          cveId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Cve)?.value || '',
          summary: vuln.advisory.summary,
          package: `${vuln.package.name} ${vuln.package.version}`,
          vulnerableVersionRange: vuln.vulnerableVersionRange,
          fixAvailable: vuln.firstPatchedVersion ? 'Yes' : 'No',
          firstPatchedVersion: vuln.firstPatchedVersion,
          severity: vuln.advisory.severity?.toPascalCase(),
          cvssScore: vuln.advisory.cvss?.score || '',
          cvssVector: vuln.advisory.cvss?.vectorString || '',
          cweIds: vuln.advisory.cwes?.map((x) => x.id)?.join(', '),
          epssPercentage: ((vuln.advisory.epss?.percentage || 0) * 100).toFixed(3),
          epssPercentile: ((vuln.advisory.epss?.percentile || 0) * 100).toFixed(2),
          publishedAt: new Date(vuln.advisory.publishedAt),
          permalink: vuln.advisory.permalink,
        };
      }),
  };

  /**
   * Licenses sheet
   */
  console.info(`Generating licenses sheet for ${licenses.length} row(s)`);
  const licensesSheet: IJsonSheet = {
    sheet: 'Licenses',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'URL', value: 'url' },
      { label: 'Packages', value: 'packages' },
      { label: 'Risk', value: 'riskSeverity' },
      { label: 'Risk Reason', value: 'riskReasons' },
    ],
    content: licenses
      .orderBy((license: ILicense) => license.id)
      .map((license: ILicense) => {
        const packagesWithLicense = packages
          .filter((p) => getPackageLicenseReferences(p).includes(license.id))
          .map((p) => `${p.name || ''}@${p.versionInfo || ''}`)
          .distinct();
        const licenseRisk = getLicenseRiskAssessment(license.id);
        return {
          id: license.id,
          name: license.name,
          packages: packagesWithLicense.length,
          riskSeverity: (licenseRisk?.severity || LicenseRiskSeverity.Low).toPascalCase(),
          riskReasons: licenseRisk?.reasons?.join('; ') || '',
          url: license.url || '',
        };
      }),
  };

  /**
   * Suppliers sheet
   */
  console.info(`Generating suppliers sheet for ${suppliers.length} row(s)`);
  const suppliersSheet: IJsonSheet = {
    sheet: 'Suppliers',
    columns: [
      { label: 'Name', value: 'name' },
      { label: 'Packages', value: 'packages' },
    ],
    content: suppliers
      .orderBy((supplier: string) => supplier)
      .map((supplier: string) => {
        const packagesFromSupplier = packages
          .filter((p) => getPackageSupplierOrganization(p) == supplier)
          .map((p) => `${p.name || ''}@${p.versionInfo || ''}`)
          .distinct();
        return {
          name: supplier || '',
          packages: packagesFromSupplier.length,
        };
      }),
  };

  /**
   * Relationships sheet
   */
  console.info(`Generating relationships sheet for ${relationships.length} row(s)`);
  const relationshipsSheet: IJsonSheet = {
    sheet: 'Relationships',
    columns: [
      { label: 'Source ID', value: 'sourceId' },
      { label: 'Type', value: 'type' },
      { label: 'Target ID', value: 'targetId' },
    ],
    content: relationships
      .orderBy((relationship: IRelationship) => relationship.spdxElementId)
      .map((relationship: IRelationship) => {
        return {
          sourceId: relationship.spdxElementId,
          targetId: relationship.relatedSpdxElement,
          type: relationship.relationshipType,
        };
      }),
  };

  // Generate the XLSX document
  console.info('Writing XLSX workbook');
  const xlsx = require('json-as-xlsx');
  return xlsx(
    [
      documentSheet,
      filesSheet,
      packagesSheet,
      securityAdvisoriesSheet,
      licensesSheet,
      suppliersSheet,
      relationshipsSheet,
    ],
    {
      extraLength: 10,
      writeOptions: {
        // https://docs.sheetjs.com/docs/api/write-options
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      },
    },
  );
}

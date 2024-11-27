import * as Path from 'path';

import { IJsonSheet } from 'json-as-xlsx';

import { ChecksumAlgorithm, getChecksum } from '../models/spdx/2.3/IChecksum';
import { getCreatorOrganization, getCreatorTool } from '../models/spdx/2.3/ICreationInfo';
import { getPackageDependsOnChain, IDocument, isPackageTopLevel } from '../models/spdx/2.3/IDocument';
import {
  ExternalRefCategory,
  ExternalRefSecurityType,
  getExternalRefPackageManager,
  parseExternalRefsAs,
} from '../models/spdx/2.3/IExternalRef';
import { getLicense } from '../models/spdx/2.3/ILicense';
import { getPackageLicense, getPackageSupplierOrganization } from '../models/spdx/2.3/IPackage';

import { getLicenseRiskAssessment, LicenseRiskSeverity } from '../ghsa/ILicense';
import { SecurityAdvisoryIdentifierType, SecurityAdvisorySeverity } from '../ghsa/ISecurityAdvisory';
import { ISecurityVulnerability } from '../ghsa/ISecurityVulnerability';

/**
 * Convert an SPDX document to XLSX spreadsheet
 * @param spdx The SPDX document
 * @return The SPDX as XLSX buffer
 */
export async function convertSpdxToXlsxAsync(spdx: IDocument): Promise<Buffer> {
  const rootPackageIds = spdx.documentDescribes;
  const relationships = spdx.relationships || [];
  const files = spdx.files || [];
  const packages = (spdx.packages || []).filter((p) => {
    return !rootPackageIds.includes(p.SPDXID);
  });

  /**
   * Document sheet
   */
  const documentSheet: IJsonSheet = {
    sheet: 'Document',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Describes', value: 'describes' },
      { label: 'Name', value: 'name' },
      { label: 'Created', value: 'created' },
      { label: 'Creator', value: 'organization' },
      { label: 'Tool', value: 'tool' },
      { label: 'SPDX Version', value: 'spdxVersion' },
      { label: 'Data License', value: 'dataLicense' },
      { label: 'Namespace', value: 'namespace' },
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
        describes: spdx.documentDescribes?.join(', ') || '',
      },
    ],
  };

  /**
   * Files sheet
   */
  const filesSheet: IJsonSheet = {
    sheet: 'Files',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Checksum (SHA256)', value: 'checksum' },
    ],
    content: files.map((file) => {
      return {
        id: file.SPDXID,
        name: Path.normalize(file.fileName),
        checksum: getChecksum(file.checksums, ChecksumAlgorithm.SHA256) || '',
      };
    }),
  };

  /**
   * Packages sheet
   */
  const packagesSheet: IJsonSheet = {
    sheet: 'Packages',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Version', value: 'version' },
      { label: 'Source', value: 'packageManager' },
      { label: 'Type', value: 'type' },
      { label: 'Introduced Through', value: 'introducedThrough' },
      { label: 'License', value: 'license' },
      { label: 'Supplier', value: 'supplier' },
      { label: 'Total Vulnerabilities', value: 'totalVulnerabilities' },
      { label: 'Critical Vulnerabilities', value: 'criticalVulnerabilities' },
      { label: 'High Vulnerabilities', value: 'highVulnerabilities' },
      { label: 'Moderate Vulnerabilities', value: 'moderateVulnerabilities' },
      { label: 'Low Vulnerabilities', value: 'lowVulnerabilities' },
      { label: 'Security Advisories', value: 'securityAdvisories' },
    ],
    content: packages.map((pkg) => {
      const securityAdvisories = parseExternalRefsAs<ISecurityVulnerability>(
        pkg.externalRefs || [],
        ExternalRefCategory.Security,
        ExternalRefSecurityType.Url,
      );
      return {
        id: pkg.SPDXID,
        name: pkg.name,
        version: pkg.versionInfo,
        type: isPackageTopLevel(spdx, pkg) ? 'Top-Level' : 'Transitive',
        introducedThrough: getPackageDependsOnChain(spdx, pkg)
          .map((x) => x.name)
          .join(' > '),
        packageManager: getExternalRefPackageManager(pkg.externalRefs) || '',
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
        license: getPackageLicense(pkg) || '',
        supplier: getPackageSupplierOrganization(pkg) || '',
      };
    }),
  };

  /**
   * Security advisories sheet
   */
  const securityAdvisoriesSheet: IJsonSheet = {
    sheet: 'Security Advisories',
    columns: [
      { label: 'GHSA ID', value: 'ghsaId' },
      { label: 'CVE ID', value: 'cveId' },
      { label: 'Summary', value: 'summary' },
      { label: 'Package', value: 'package' },
      { label: 'Vulnerable Versions', value: 'vulnerableVersionRange' },
      { label: 'Fixed In', value: 'firstPatchedVersion' },
      { label: 'Severity', value: 'severity' },
      { label: 'CVSS Score', value: 'cvssScore' },
      { label: 'CVSS Vector', value: 'cvssVector' },
      { label: 'CWEs', value: 'cweIds' },
      { label: 'EPSS Percentage', value: 'epssPercentage' },
      { label: 'EPSS Percentile', value: 'epssPercentile' },
      { label: 'Published At', value: 'publishedAt' },
      { label: 'URL', value: 'permalink' },
    ],
    content: packages
      .map((pkg) => pkg.externalRefs || [])
      .flatMap((externalRefs) =>
        parseExternalRefsAs<ISecurityVulnerability>(
          externalRefs,
          ExternalRefCategory.Security,
          ExternalRefSecurityType.Url,
        ),
      )
      .filter((vuln) => vuln.package && vuln.advisory)
      .map((vuln) => {
        return {
          ghsaId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Ghsa)?.value || '',
          cveId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Cve)?.value || '',
          summary: vuln.advisory.summary,
          package: `${vuln.package.name} ${vuln.package.version}`,
          vulnerableVersionRange: vuln.vulnerableVersionRange,
          firstPatchedVersion: vuln.firstPatchedVersion,
          severity: vuln.advisory.severity.toPascalCase(),
          cvssScore: vuln.advisory.cvss.score,
          cvssVector: vuln.advisory.cvss.vectorString,
          cweIds: vuln.advisory.cwes.map((x) => x.id).join(', '),
          epssPercentage: (vuln.advisory.epss.percentage * 100).toFixed(3),
          epssPercentile: (vuln.advisory.epss.percentile * 100).toFixed(2),
          publishedAt: vuln.advisory.publishedAt,
          permalink: vuln.advisory.permalink,
        };
      }),
  };

  /**
   * Licenses sheet
   */
  const licensesSheet: IJsonSheet = {
    sheet: 'Licenses',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Packages', value: 'packages' },
      { label: 'Risk', value: 'riskSeverity' },
      { label: 'Risk Reason', value: 'riskReasons' },
      { label: 'URL', value: 'url' },
    ],
    content: Array.from(new Set(packages.map((pkg) => getPackageLicense(pkg))))
      .filter((license): license is string => !!license)
      .map((license: string) => {
        const licenseDetails = getLicense(license);
        const licensePackages = packages.filter((p) => getPackageLicense(p) == license);
        const licenseRisk = getLicenseRiskAssessment(license);
        return {
          id: licenseDetails?.licenseId || license || '',
          name: licenseDetails?.name || license || '',
          packages: licensePackages.length,
          riskSeverity: licenseRisk.severity.toPascalCase(),
          riskReasons: licenseRisk.severity !== LicenseRiskSeverity.Unknown ? licenseRisk.reasons.join('; ') : '',
          url: licenseDetails?.reference || '',
        };
      }),
  };

  /**
   * Suppliers sheet
   */
  const suppliersSheet: IJsonSheet = {
    sheet: 'Suppliers',
    columns: [
      { label: 'Name', value: 'name' },
      { label: 'Packages', value: 'packages' },
    ],
    content: Array.from(new Set(packages.map((pkg) => getPackageSupplierOrganization(pkg))))
      .filter((supplier): supplier is string => !!supplier)
      .map((supplier) => {
        const supplierPackages = packages.filter((p) => getPackageSupplierOrganization(p) == supplier);
        return {
          name: supplier || '',
          packages: supplierPackages.length,
        };
      }),
  };

  /**
   * Relationships sheet
   */
  const relationshipsSheet: IJsonSheet = {
    sheet: 'Relationships',
    columns: [
      { label: 'Source ID', value: 'sourceId' },
      { label: 'Type', value: 'type' },
      { label: 'Target ID', value: 'targetId' },
    ],
    content: relationships.map((relationship) => {
      return {
        sourceId: relationship.spdxElementId,
        targetId: relationship.relatedSpdxElement,
        type: relationship.relationshipType,
      };
    }),
  };

  // Generate the XLSX document
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
      // https://docs.sheetjs.com/docs/api/write-options
      writeOptions: {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      },
    },
  );
}

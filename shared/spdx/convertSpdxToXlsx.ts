import * as Path from 'path';

import { IJsonSheet } from 'json-as-xlsx';

import { getSeverityByName } from '../models/securityAdvisory/Severities';
import { ChecksumAlgorithm, getChecksum } from '../models/spdx/2.3/IChecksum';
import { getCreatorOrganization, getCreatorTool } from '../models/spdx/2.3/ICreationInfo';
import { getPackageDependsOnChain, IDocument, isPackageTopLevel } from '../models/spdx/2.3/IDocument';
import {
  ExternalRefCategory,
  ExternalRefSecurityType,
  getExternalRefPackageManager,
  IExternalRef,
  parseExternalRefAs,
  parseExternalRefsAs,
} from '../models/spdx/2.3/IExternalRef';
import { IFile } from '../models/spdx/2.3/IFile';
import { getLicensesFromExpression, ILicense } from '../models/spdx/2.3/ILicense';
import { getPackageLicenseExpression, getPackageSupplierOrganization, IPackage } from '../models/spdx/2.3/IPackage';
import { IRelationship } from '../models/spdx/2.3/IRelationship';

import { getLicenseRiskAssessment, LicenseRiskSeverity } from '../ghsa/ILicense';
import { SecurityAdvisoryIdentifierType, SecurityAdvisorySeverity } from '../ghsa/ISecurityAdvisory';
import { ISecurityVulnerability } from '../ghsa/ISecurityVulnerability';

import '../extensions/ArrayExtensions';

/**
 * Convert an SPDX document to XLSX spreadsheet
 * @param spdx The SPDX document
 * @return The SPDX as XLSX buffer
 */
export async function convertSpdxToXlsxAsync(spdx: IDocument): Promise<Buffer> {
  console.info('Parising SPDX document objects');
  const rootPackageIds = spdx.documentDescribes;
  const relationships = spdx.relationships || [];
  const files = spdx.files || [];
  const packages = (spdx.packages || []).filter((p) => {
    return !rootPackageIds.includes(p.SPDXID);
  });
  const securityAdvisories = packages
    .flatMap((pkg: IPackage) => pkg.externalRefs || [])
    .map((externalRef: IExternalRef) =>
      parseExternalRefAs<ISecurityVulnerability>(
        externalRef,
        ExternalRefCategory.Security,
        ExternalRefSecurityType.Url,
      ),
    )
    .filter((vuln): vuln is ISecurityVulnerability => !!vuln && !!vuln.package && !!vuln.advisory)
    .distinctBy(
      (vuln: ISecurityVulnerability) =>
        vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Ghsa)?.value,
    );
  const licenses = packages
    .map((pkg) => getPackageLicenseExpression(pkg))
    .distinct()
    .filter((licenseExpression): licenseExpression is string => !!licenseExpression)
    .flatMap((licenseExpression: string) => getLicensesFromExpression(licenseExpression))
    .filter((license): license is ILicense => !!license)
    .distinctBy((license: ILicense) => license.licenseId);
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
  console.info(`Generating files sheet for ${files.length} row(s)`);
  const filesSheet: IJsonSheet = {
    sheet: 'Files',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Checksum (SHA256)', value: 'checksum' },
    ],
    content: files
      .orderBy((file: IFile) => file.fileName)
      .map((file: IFile) => {
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
  console.info(`Generating packages sheet for ${packages.length} row(s)`);
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
    content: packages
      .orderBy((pkg: IPackage) => pkg.name)
      .map((pkg: IPackage) => {
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
          license: getPackageLicenseExpression(pkg) || '',
          supplier: getPackageSupplierOrganization(pkg) || '',
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
      { label: 'CWEs', value: 'cweIds' },
      { label: 'EPSS Percentage', value: 'epssPercentage' },
      { label: 'EPSS Percentile', value: 'epssPercentile' },
      { label: 'Published On', value: 'publishedAt' },
      { label: 'URL', value: 'permalink' },
    ],
    content: securityAdvisories
      .orderBy((vuln: ISecurityVulnerability) => getSeverityByName(vuln.advisory.severity)?.id, false)
      .map((vuln: ISecurityVulnerability) => {
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
      .orderBy((license: ILicense) => license.licenseId)
      .map((license: ILicense) => {
        const packagesWithLicense = packages.filter((p) => getPackageLicenseExpression(p)?.includes(license.licenseId));
        const licenseRisk = getLicenseRiskAssessment(license.licenseId);
        return {
          id: license.licenseId,
          name: license.name,
          packages: packagesWithLicense.length,
          riskSeverity: (licenseRisk?.severity || LicenseRiskSeverity.Low).toPascalCase(),
          riskReasons: licenseRisk?.reasons?.join('; ') || '',
          url: license.reference,
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
        const packagesFromSupplier = packages.filter((p) => getPackageSupplierOrganization(p) == supplier);
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
      // https://docs.sheetjs.com/docs/api/write-options
      writeOptions: {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      },
    },
  );
}
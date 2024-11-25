import * as Path from 'path';

import { IJsonSheet, ISettings } from 'json-as-xlsx';
import { IPackage, IRelationship, ISpdx22Document } from '../models/Spdx22Document';

export function downloadSpdxAsXlsx(doc: ISpdx22Document): void {
  const xlsx = require('json-as-xlsx');

  const dependsOnRelationships = (doc?.relationships || []).filter((r) => r.relationshipType === 'DEPENDS_ON');
  const rootPackageId = doc.documentDescribes?.[0];
  const packages = (doc?.packages || []).filter((p) => {
    return dependsOnRelationships?.some((r) => r.relatedSpdxElement === p.SPDXID);
  });

  const documentSheet: IJsonSheet = {
    sheet: 'Document',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Created', value: 'created' },
      { label: 'Creator', value: 'organization' },
      { label: 'Tool', value: 'tool' },
      { label: 'Version', value: 'spdxVersion' },
      { label: 'Data License', value: 'dataLicense' },
      { label: 'Describes', value: 'describes' },
    ],
    content: [
      {
        id: doc.SPDXID,
        name: doc.name,
        spdxVersion: doc.spdxVersion,
        dataLicense: doc.dataLicense,
        created: new Date(doc.creationInfo.created).toLocaleString(),
        organization:
          doc.creationInfo.creators.map((c) => c.match(/^Organization\:(.*)$/i)?.[1]?.trim()).filter((c) => c)?.[0] ||
          '',
        tool: doc.creationInfo.creators.map((c) => c.match(/^Tool\:(.*)$/i)?.[1]?.trim()).filter((c) => c)?.[0] || '',
        describes: doc.documentDescribes?.join(', ') || '',
      },
    ],
  };

  const filesSheet: IJsonSheet = {
    sheet: 'Files',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Checksum (SHA256)', value: 'checksum' },
    ],
    content: doc.files.map((x) => {
      return {
        id: x.SPDXID,
        name: Path.normalize(x.fileName),
        checksum: x.checksums.find((c: any) => c.algorithm === 'SHA256')?.checksumValue || '',
      };
    }),
  };

  const packagesSheet: IJsonSheet = {
    sheet: 'Packages',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Type', value: 'packageManager' },
      { label: 'Name', value: 'name' },
      { label: 'Version', value: 'version' },
      { label: 'Level', value: 'level' },
      { label: 'Introduced Through', value: 'introducedThrough' },
      { label: 'Vulnerable', value: 'isVulnerable' },
      { label: 'Security Advisories', value: 'securityAdvisories' },
      { label: 'License', value: 'license' },
      { label: 'Supplier', value: 'supplier' },
    ],
    content: doc.packages.map((x) => {
      const packageManager = x.externalRefs
        ?.find((a) => a.referenceCategory === 'PACKAGE-MANAGER' && a.referenceType === 'purl')
        ?.referenceLocator?.match(/^pkg\:([^\:]+)\//i)?.[1]
        ?.toPascalCase()
        ?.trim();
      const securityAdvisories = x.externalRefs?.filter(
        (a) => a.referenceCategory === 'SECURITY' && a.referenceType === 'advisory',
      );
      const isTopLevel =
        x.SPDXID == rootPackageId ||
        dependsOnRelationships.some(
          (r) =>
            r.spdxElementId == rootPackageId &&
            r.relatedSpdxElement === x.SPDXID &&
            r.relationshipType === 'DEPENDS_ON',
        );
      return {
        id: x.SPDXID,
        name: x.name,
        version: x.versionInfo,
        supplier: x.supplier?.match(/^Organization\:(.*)$/i)?.[1]?.trim() || x.supplier || '',
        license: x.licenseConcluded || x.licenseDeclared || '',
        level: isTopLevel ? 'Top-Level' : 'Transitive',
        introducedThrough: getTransitivePackageChain(x.SPDXID, packages, dependsOnRelationships).join(' > '),
        packageManager: packageManager || '',
        isVulnerable: securityAdvisories?.length || false ? 'Yes' : 'No',
        securityAdvisories: securityAdvisories
          ?.map((a) => a.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0])
          .join(', '),
      };
    }),
  };

  const securityAdvisoriesSheet: IJsonSheet = {
    sheet: 'Security Advisories',
    columns: [
      { label: 'ID', value: 'id' },
      { label: 'Severity', value: 'severity' },
      { label: 'Summary', value: 'summary' },
      { label: 'Package', value: 'package' },
      { label: 'URL', value: 'url' },
    ],
    content: doc.packages
      .flatMap((p) => {
        return p.externalRefs.filter((r) => r.referenceCategory == 'SECURITY' && r.referenceType == 'advisory') || [];
      })
      .map((x) => {
        const pkg = doc.packages.find((p) => p.externalRefs.includes(x));
        const ghsaId = x.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0];
        const severity = x.comment?.match(/^\[(\w+)\]/)?.[1]?.toPascalCase();
        const summary = x.comment?.match(/^\[(\w+)\]([^;]*)/)?.[2]?.trim();
        const url = x.referenceLocator;
        return {
          id: ghsaId || '',
          severity: severity || '',
          summary: summary || '',
          url: url,
          package: `${pkg?.name} ${pkg?.versionInfo}`,
        };
      }),
  };

  const data: IJsonSheet[] = [documentSheet, filesSheet, packagesSheet, securityAdvisoriesSheet];

  const settings: ISettings = {
    fileName: `${doc.name}.spdx`,
    writeMode: 'writeFile',
    writeOptions: {
      // https://docs.sheetjs.com/docs/api/write-options
      compression: true,
    },
  };

  xlsx(data, settings);
}

function getTransitivePackageChain(
  packageId: string,
  packages: IPackage[],
  dependsOnRelationships: IRelationship[],
): string[] {
  const chain: string[] = [];
  let currentId = packageId;
  while (currentId) {
    const relationship = dependsOnRelationships.find((r) => r.relatedSpdxElement === currentId);
    if (!relationship) break;

    const pkg = packages.find((p) => p.SPDXID === relationship.spdxElementId);
    if (!pkg) break;

    chain.unshift(pkg.name);
    currentId = relationship.spdxElementId;
  }

  return chain;
}

import { spdxConstantsAreEqual } from './Constants';

export interface IChecksum {
  algorithm: ChecksumAlgorithm;
  checksumValue: string;
}

export enum ChecksumAlgorithm {
  SHA1 = 'SHA1',
  SHA224 = 'SHA224',
  SHA256 = 'SHA256',
  SHA384 = 'SHA384',
  SHA512 = 'SHA512',
  SHA3_256 = 'SHA3-256',
  SHA3_384 = 'SHA3-384',
  SHA3_512 = 'SHA3-512',
  BLAKE2b_256 = 'BLAKE2b-256',
  BLAKE2b_384 = 'BLAKE2b-384',
  BLAKE2b_512 = 'BLAKE2b-512',
  BLAKE3 = 'BLAKE3',
  MD2 = 'MD2',
  MD4 = 'MD4',
  MD5 = 'MD5',
  MD6 = 'MD6',
  ADLER32 = 'ADLER32',
}

export function getChecksum(checksums: IChecksum[], algorithm: ChecksumAlgorithm): string | undefined {
  return checksums.find((checksum) => spdxConstantsAreEqual(checksum.algorithm, algorithm))?.checksumValue;
}

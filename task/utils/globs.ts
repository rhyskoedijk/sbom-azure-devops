import fs from 'fs';
import path from 'path';

import { globSync } from 'glob';

/**
 * Resolve path globs to absolute paths
 * @param paths The path globs to resolve
 * @param cwd The current working directory
 * @returns The resolved paths
 */
export function resolvePathGlobs(paths: string | string[], cwd?: string): string[] {
  const options = { absolute: true, realpath: true, cwd: cwd };
  const patterns = Array.isArray(paths)
    ? paths
    : paths
        .split(/\r?\n|;/)
        .map((p) => p.trim())
        .filter((p) => p);
  const result = globSync(patterns, options).distinct();
  console.log('GLOB', patterns, result);
  return result;
}

/**
 * Get files matching the specified path globs
 * @param paths The path globs to match
 * @param cwd The current working directory
 * @returns The files matching the path globs
 */
export function getFilesMatchingPathGlobs(paths: string | string[], cwd?: string): string[] {
  return resolvePathGlobs(paths, cwd)
    .flatMap((p) => getFilesInDirectoryRecursive(fs.lstatSync(p).isDirectory() ? p : path.dirname(p)))
    .distinct();
}

/**
 * Recursively read a directory
 * @param directory The directory to read
 * @returns The files in the directory
 */
function getFilesInDirectoryRecursive(directory: string): string[] {
  const files = fs.readdirSync(directory);
  const resolvedFiles = [];
  for (const file of files) {
    const filePath = path.join(directory, file);
    if (fs.lstatSync(filePath as string).isDirectory()) {
      resolvedFiles.push(...getFilesInDirectoryRecursive(filePath));
    } else if (fs.lstatSync(filePath as string).isFile()) {
      resolvedFiles.push(filePath);
    }
  }
  console.log('DIR FILES', directory, resolvedFiles);
  return resolvedFiles;
}

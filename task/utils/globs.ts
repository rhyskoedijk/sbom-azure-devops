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
  const resolvedPaths = resolvePathGlobs(paths, cwd);
  return resolvedPaths
    .flatMap((p) => (fs.lstatSync(p).isDirectory() ? getFilesMatchingPathGlobs(path.join(p, '*')) : [p]))
    .distinct();
}

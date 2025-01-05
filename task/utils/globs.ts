import fs from 'fs';
import path from 'path';

import { globSync } from 'glob';

export function resolvePathGlobs(paths: string | string[], cwd?: string): string[] {
  const patterns = Array.isArray(paths)
    ? paths
    : paths
        .split(/\r?\n|;/)
        .map((p) => p.trim())
        .filter((p) => p);
  return globSync(patterns, { cwd: cwd, absolute: true, realpath: true });
}

export function getFilesMatchingPathGlobs(paths: string | string[], cwd?: string): string[] {
  const resolvedPaths = resolvePathGlobs(paths, cwd);
  return resolvedPaths.flatMap((p) =>
    fs.lstatSync(p).isDirectory() ? getFilesMatchingPathGlobs(path.join(p, '*')) : [p],
  );
}

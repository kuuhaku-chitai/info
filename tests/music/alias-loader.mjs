/**
 * `@/` パスエイリアスと拡張子なし相対importをNode実行時に解決するローダー。
 * dbtest（musicDb等、tsconfigのalias前提のソース）を
 * strip-typesで直接実行するために使う。
 */
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

const SRC_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../../src');

function resolveExtensionless(full) {
  const asFile = full + '.ts';
  const asIndex = resolvePath(full, 'index.ts');
  return existsSync(asFile) ? asFile : asIndex;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const full = resolvePath(SRC_ROOT, specifier.slice(2));
    return nextResolve(pathToFileURL(resolveExtensionless(full)).href, context);
  }
  if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
    const parentDir = fileURLToPath(new URL('.', context.parentURL));
    const full = resolvePath(parentDir, specifier);
    if (!existsSync(full) && !existsSync(full + '.ts')) return nextResolve(specifier, context);
    return nextResolve(pathToFileURL(resolveExtensionless(full)).href, context);
  }
  return nextResolve(specifier, context);
}

// Test-only module resolution hooks.
//
// The plugin's Config is a Schemastery schema, and `@deepseek-ai/schemastery` is a
// harness-internal package that is not on the public npm registry: at runtime the
// Host resolves it from its own module tree, which a bare Node test process does
// not have. These hooks redirect that one specifier family to the vendored copy in
// `.vendor-tools/` and leave every other specifier to Node's default resolver.
//
// Only `npm test` registers this file. The plugin itself never imports the
// vendored copies.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const packages = path.join(repoRoot, '.vendor-tools', 'node_modules', '@deepseek-ai');

const REDIRECTED = new Map([
  ['@deepseek-ai/schemastery', ['schemastery', 'lib', 'index.mjs']],
  ['@deepseek-ai/schemastery/package.json', ['schemastery', 'package.json']],
  ['@deepseek-ai/cosmokit', ['cosmokit', 'lib', 'index.js']],
  ['@deepseek-ai/cosmokit/package.json', ['cosmokit', 'package.json']],
]);

export async function resolve(specifier, context, nextResolve) {
  const target = REDIRECTED.get(specifier);
  if (target) {
    return nextResolve(pathToFileURL(path.join(packages, ...target)).href, context);
  }
  return nextResolve(specifier, context);
}

// Test-only bootstrap: registers the vendored-module hooks before the test files
// import the plugin. See ./resolve-harness-peer.mjs for what it redirects.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./resolve-harness-peer.mjs', pathToFileURL(`${import.meta.dirname}/`));

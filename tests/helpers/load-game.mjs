import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../../app/", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();

// Transpile source only; hooks run in the real React runtime, not a mocked hook implementation.
export function loadGame(name) {
  return loadModule(`game/${name}`);
}

export function loadHome() {
  return loadModule("page").default;
}

function loadModule(name) {
  if (cache.has(name)) return cache.get(name);
  const file = [".ts", ".tsx"].map(ext => path.join(root, name + ext)).find(existsSync);
  const output = ts.transpileModule(readFileSync(file,"utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const loaded = {exports:{}};
  const require = specifier => specifier.startsWith("./") ? loadModule(path.join(path.dirname(name),specifier)) : nativeRequire(specifier);
  new Function("exports", "require", "module", output)(loaded.exports, require, loaded);
  cache.set(name, loaded.exports);
  return loaded.exports;
}

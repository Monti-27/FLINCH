import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

let checked = 0;
for (const directory of ["packages/client/src", "apps/keeper/src", "apps/web/src", "apps/web/tests", "tests/client", "tests/keeper", "tests/stack", "tests/harness", "tools/local", "tools/devnet"]) {
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    const path = resolve(entry.parentPath, entry.name);
    const source = readFileSync(path, "utf8");
    assert(source.split("\n").length <= 300, `${path} exceeds 300 lines`);
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const visit = node => {
      const comments = [...ts.getLeadingCommentRanges(source, node.getFullStart()) ?? [], ...ts.getTrailingCommentRanges(source, node.getEnd()) ?? []];
      assert(comments.length === 0, `${path} contains a code comment`);
      node.getChildren(tree).forEach(visit);
    };
    visit(tree);
    checked++;
  }
}
console.log(`Checked ${checked} handwritten TypeScript modules for comments and size`);

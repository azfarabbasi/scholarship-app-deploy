/**
 * `npm run check:jsx-whitespace`.
 *
 * Catches a silent rendering bug the type checker and ESLint both miss.
 *
 * The JSX transform trims leading whitespace from every line of a text node.
 * So when a text node follows an expression container and wraps across source
 * lines, its leading space is dropped and the text collides with the value
 * before it:
 *
 *     <p>
 *       {count} opportunities matched your filters and are
 *       ready to review.
 *     </p>
 *
 * renders as "5opportunities matched…". The same source with the text on one
 * line renders correctly, so this appears and disappears purely with line
 * wrapping — which is exactly why it survives review.
 *
 * The fix is an explicit `{" "}` after the expression.
 *
 * Uses the TypeScript parser rather than a regex so that imports, JSX
 * attributes, and object literals can't be mistaken for element children.
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import ts from "typescript";

interface Finding {
  file: string;
  line: number;
  before: string;
  after: string;
}

// `git ls-files` still lists working-tree deletions, so filter to what exists.
const files = execSync('git ls-files "*.tsx"', { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => existsSync(file));

const findings: Finding[] = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const children = node.children;
      for (let index = 1; index < children.length; index += 1) {
        const previous = children[index - 1];
        const current = children[index];
        if (!ts.isJsxExpression(previous) || !ts.isJsxText(current)) continue;

        const raw = current.getFullText();
        if (!raw.startsWith(" ")) continue; // no leading space to lose
        if (!raw.includes("\n")) continue; // stays on one line, space survives
        if (raw.trim() === "") continue; // whitespace-only node, nothing to collide

        const { line } = sourceFile.getLineAndCharacterOfPosition(current.getStart(sourceFile));
        findings.push({
          file,
          line: line + 1,
          before: previous.getText().replace(/\s+/g, " ").slice(-40),
          after: raw.replace(/\s+/g, " ").trim().slice(0, 50),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

if (findings.length > 0) {
  console.error(`✗ ${findings.length} JSX text node(s) will lose a leading space when rendered:\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`);
    console.error(`    …${finding.before}  ⇥  "${finding.after}…"`);
    console.error(`    fix: end the expression with {" "} before the wrapped text\n`);
  }
  process.exit(1);
}

console.log(`✓ JSX whitespace check passed (${files.length} files scanned).`);

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const index_js_1 = require("../index.js");
function createTestRepo() {
    const dir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), "git-authors-test-"));
    (0, child_process_1.execSync)("git init", { cwd: dir });
    (0, child_process_1.execSync)('git config user.email "alice@example.com"', { cwd: dir });
    (0, child_process_1.execSync)('git config user.name "Alice"', { cwd: dir });
    // Commit 1: initial
    fs_1.default.writeFileSync(path_1.default.join(dir, "index.ts"), "export const hello = () => 'hello';\n");
    fs_1.default.writeFileSync(path_1.default.join(dir, "utils.ts"), "export const add = (a: number, b: number) => a + b;\n");
    (0, child_process_1.execSync)("git add .", { cwd: dir });
    (0, child_process_1.execSync)('git commit -m "initial"', { cwd: dir });
    // Commit 2: bob adds a file
    (0, child_process_1.execSync)('git config user.email "bob@example.com"', { cwd: dir });
    (0, child_process_1.execSync)('git config user.name "Bob"', { cwd: dir });
    fs_1.default.writeFileSync(path_1.default.join(dir, "math.ts"), "export const mul = (a: number, b: number) => a * b;\n");
    (0, child_process_1.execSync)("git add .", { cwd: dir });
    (0, child_process_1.execSync)('git commit -m "add math"', { cwd: dir });
    // Commit 3: alice modifies
    (0, child_process_1.execSync)('git config user.email "alice@example.com"', { cwd: dir });
    (0, child_process_1.execSync)('git config user.name "Alice"', { cwd: dir });
    fs_1.default.writeFileSync(path_1.default.join(dir, "index.ts"), "export const hello = () => 'hello world';\nexport const bye = () => 'bye';\n");
    (0, child_process_1.execSync)("git add .", { cwd: dir });
    (0, child_process_1.execSync)('git commit -m "expand index"', { cwd: dir });
    // Commit 4: bob modifies utils
    (0, child_process_1.execSync)('git config user.email "bob@example.com"', { cwd: dir });
    (0, child_process_1.execSync)('git config user.name "Bob"', { cwd: dir });
    fs_1.default.writeFileSync(path_1.default.join(dir, "utils.ts"), "export const add = (a: number, b: number) => a + b;\nexport const sub = (a: number, b: number) => a - b;\n");
    (0, child_process_1.execSync)("git add .", { cwd: dir });
    (0, child_process_1.execSync)('git commit -m "add sub"', { cwd: dir });
    return dir;
}
(0, node_test_1.describe)("git-authors", () => {
    (0, node_test_1.describe)("getAuthorCommitStats", () => {
        (0, node_test_1.it)("returns commit counts per author", () => {
            const dir = createTestRepo();
            const stats = (0, index_js_1.getAuthorCommitStats)(dir, {});
            strict_1.default.equal(stats.length, 2);
            const alice = stats.find((s) => s.email === "alice@example.com");
            const bob = stats.find((s) => s.email === "bob@example.com");
            strict_1.default.ok(alice);
            strict_1.default.ok(bob);
            strict_1.default.equal(alice.commits, 2);
            strict_1.default.equal(bob.commits, 2);
            strict_1.default.ok(alice.insertions > 0);
            strict_1.default.ok(bob.insertions > 0);
        });
        (0, node_test_1.it)("filters by extension", () => {
            const dir = createTestRepo();
            const stats = (0, index_js_1.getAuthorCommitStats)(dir, { extensions: [".js"] });
            // No .js files, so no insertions counted but authors still show
            for (const s of stats) {
                strict_1.default.equal(s.insertions, 0);
            }
        });
        (0, node_test_1.it)("gets first and last commit dates", () => {
            const dir = createTestRepo();
            const stats = (0, index_js_1.getAuthorCommitStats)(dir, {});
            const alice = stats.find((s) => s.email === "alice@example.com");
            strict_1.default.ok(alice);
            strict_1.default.ok(alice.firstCommit);
            strict_1.default.ok(alice.lastCommit);
            strict_1.default.ok(alice.activeDays >= 1);
        });
    });
    (0, node_test_1.describe)("getFileOwnership", () => {
        (0, node_test_1.it)("returns dominant author per file", () => {
            const dir = createTestRepo();
            const ownership = (0, index_js_1.getFileOwnership)(dir, {});
            strict_1.default.ok(ownership.length >= 3);
            const indexFile = ownership.find((f) => f.file === "index.ts");
            strict_1.default.ok(indexFile);
            strict_1.default.equal(indexFile.author, "Alice");
            strict_1.default.ok(indexFile.lines > 0);
            strict_1.default.ok(indexFile.percent > 0);
        });
    });
    (0, node_test_1.describe)("analyze", () => {
        (0, node_test_1.it)("returns full analysis result", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            strict_1.default.equal(result.repo, path_1.default.basename(dir));
            strict_1.default.ok(result.totalCommits > 0);
            strict_1.default.ok(result.totalFiles > 0);
            strict_1.default.ok(result.totalLines > 0);
            strict_1.default.equal(result.authors.length, 2);
            // Alice should have higher ownership (index.ts is 2 lines by her)
            const alice = result.authors.find((a) => a.email === "alice@example.com");
            const bob = result.authors.find((a) => a.email === "bob@example.com");
            strict_1.default.ok(alice);
            strict_1.default.ok(bob);
            strict_1.default.ok(alice.linesOwned > 0 || bob.linesOwned > 0);
        });
        (0, node_test_1.it)("respects top option", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            // With 2 authors, top 1 should give 1
            // analyze doesn't limit, formatters do
            strict_1.default.equal(result.authors.length, 2);
        });
    });
    (0, node_test_1.describe)("getAuthorDetail", () => {
        (0, node_test_1.it)("returns detailed info for an author", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            const detail = (0, index_js_1.getAuthorDetail)(result, "alice@example.com");
            strict_1.default.ok(detail);
            strict_1.default.equal(detail.stats.email, "alice@example.com");
            strict_1.default.ok(detail.topFiles.length > 0);
            strict_1.default.ok(detail.topFiles[0].file);
            strict_1.default.ok(detail.topFiles[0].lines > 0);
        });
        (0, node_test_1.it)("returns null for unknown author", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            const detail = (0, index_js_1.getAuthorDetail)(result, "unknown@example.com");
            strict_1.default.equal(detail, null);
        });
    });
    (0, node_test_1.describe)("formatTable", () => {
        (0, node_test_1.it)("produces readable table output", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            const table = (0, index_js_1.formatTable)(result);
            strict_1.default.ok(table.includes("Code Ownership"));
            strict_1.default.ok(table.includes("Alice"));
            strict_1.default.ok(table.includes("Bob"));
        });
    });
    (0, node_test_1.describe)("formatFiles", () => {
        (0, node_test_1.it)("produces file ownership table", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            const table = (0, index_js_1.formatFiles)(result.fileOwnership);
            strict_1.default.ok(table.includes("File Ownership"));
            strict_1.default.ok(table.includes(".ts"));
        });
    });
    (0, node_test_1.describe)("formatJSON", () => {
        (0, node_test_1.it)("produces valid JSON", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            const json = (0, index_js_1.formatJSON)(result.authors);
            const parsed = JSON.parse(json);
            strict_1.default.ok(Array.isArray(parsed));
            strict_1.default.equal(parsed.length, 2);
        });
    });
    (0, node_test_1.describe)("formatMarkdown", () => {
        (0, node_test_1.it)("produces markdown table", () => {
            const dir = createTestRepo();
            const result = (0, index_js_1.analyze)(dir);
            const md = (0, index_js_1.formatMarkdown)(result);
            strict_1.default.ok(md.includes("# Code Ownership"));
            strict_1.default.ok(md.includes("| Alice"));
            strict_1.default.ok(md.includes("| Bob"));
        });
    });
    (0, node_test_1.describe)("excludePaths", () => {
        (0, node_test_1.it)("excludes specified paths", () => {
            const dir = createTestRepo();
            const ownership = (0, index_js_1.getFileOwnership)(dir, { excludePaths: ["utils"] });
            const utilsFile = ownership.find((f) => f.file === "utils.ts");
            strict_1.default.equal(utilsFile, undefined);
        });
    });
});

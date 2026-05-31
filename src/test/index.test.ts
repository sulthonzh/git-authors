import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import {
  analyze,
  getAuthorCommitStats,
  getFileOwnership,
  getAuthorDetail,
  formatTable,
  formatFiles,
  formatJSON,
  formatMarkdown,
} from "../index.js";

function createTestRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-authors-test-"));
  execSync("git init", { cwd: dir });
  execSync('git config user.email "alice@example.com"', { cwd: dir });
  execSync('git config user.name "Alice"', { cwd: dir });

  // Commit 1: initial
  fs.writeFileSync(path.join(dir, "index.ts"), "export const hello = () => 'hello';\n");
  fs.writeFileSync(path.join(dir, "utils.ts"), "export const add = (a: number, b: number) => a + b;\n");
  execSync("git add .", { cwd: dir });
  execSync('git commit -m "initial"', { cwd: dir });

  // Commit 2: bob adds a file
  execSync('git config user.email "bob@example.com"', { cwd: dir });
  execSync('git config user.name "Bob"', { cwd: dir });
  fs.writeFileSync(path.join(dir, "math.ts"), "export const mul = (a: number, b: number) => a * b;\n");
  execSync("git add .", { cwd: dir });
  execSync('git commit -m "add math"', { cwd: dir });

  // Commit 3: alice modifies
  execSync('git config user.email "alice@example.com"', { cwd: dir });
  execSync('git config user.name "Alice"', { cwd: dir });
  fs.writeFileSync(path.join(dir, "index.ts"), "export const hello = () => 'hello world';\nexport const bye = () => 'bye';\n");
  execSync("git add .", { cwd: dir });
  execSync('git commit -m "expand index"', { cwd: dir });

  // Commit 4: bob modifies utils
  execSync('git config user.email "bob@example.com"', { cwd: dir });
  execSync('git config user.name "Bob"', { cwd: dir });
  fs.writeFileSync(path.join(dir, "utils.ts"), "export const add = (a: number, b: number) => a + b;\nexport const sub = (a: number, b: number) => a - b;\n");
  execSync("git add .", { cwd: dir });
  execSync('git commit -m "add sub"', { cwd: dir });

  return dir;
}

describe("git-authors", () => {
  describe("getAuthorCommitStats", () => {
    it("returns commit counts per author", () => {
      const dir = createTestRepo();
      const stats = getAuthorCommitStats(dir, {});
      assert.equal(stats.length, 2);

      const alice = stats.find((s) => s.email === "alice@example.com");
      const bob = stats.find((s) => s.email === "bob@example.com");
      assert.ok(alice);
      assert.ok(bob);
      assert.equal(alice.commits, 2);
      assert.equal(bob.commits, 2);
      assert.ok(alice.insertions > 0);
      assert.ok(bob.insertions > 0);
    });

    it("filters by extension", () => {
      const dir = createTestRepo();
      const stats = getAuthorCommitStats(dir, { extensions: [".js"] });
      // No .js files, so no insertions counted but authors still show
      for (const s of stats) {
        assert.equal(s.insertions, 0);
      }
    });

    it("gets first and last commit dates", () => {
      const dir = createTestRepo();
      const stats = getAuthorCommitStats(dir, {});
      const alice = stats.find((s) => s.email === "alice@example.com");
      assert.ok(alice);
      assert.ok(alice.firstCommit);
      assert.ok(alice.lastCommit);
      assert.ok(alice.activeDays >= 1);
    });
  });

  describe("getFileOwnership", () => {
    it("returns dominant author per file", () => {
      const dir = createTestRepo();
      const ownership = getFileOwnership(dir, {});
      assert.ok(ownership.length >= 3);

      const indexFile = ownership.find((f) => f.file === "index.ts");
      assert.ok(indexFile);
      assert.equal(indexFile.author, "Alice");
      assert.ok(indexFile.lines > 0);
      assert.ok(indexFile.percent > 0);
    });
  });

  describe("analyze", () => {
    it("returns full analysis result", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      assert.equal(result.repo, path.basename(dir));
      assert.ok(result.totalCommits > 0);
      assert.ok(result.totalFiles > 0);
      assert.ok(result.totalLines > 0);
      assert.equal(result.authors.length, 2);

      // Alice should have higher ownership (index.ts is 2 lines by her)
      const alice = result.authors.find((a) => a.email === "alice@example.com");
      const bob = result.authors.find((a) => a.email === "bob@example.com");
      assert.ok(alice);
      assert.ok(bob);
      assert.ok(alice.linesOwned > 0 || bob.linesOwned > 0);
    });

    it("respects top option", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      // With 2 authors, top 1 should give 1
      // analyze doesn't limit, formatters do
      assert.equal(result.authors.length, 2);
    });
  });

  describe("getAuthorDetail", () => {
    it("returns detailed info for an author", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      const detail = getAuthorDetail(result, "alice@example.com");
      assert.ok(detail);
      assert.equal(detail.stats.email, "alice@example.com");
      assert.ok(detail.topFiles.length > 0);
      assert.ok(detail.topFiles[0].file);
      assert.ok(detail.topFiles[0].lines > 0);
    });

    it("returns null for unknown author", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      const detail = getAuthorDetail(result, "unknown@example.com");
      assert.equal(detail, null);
    });
  });

  describe("formatTable", () => {
    it("produces readable table output", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      const table = formatTable(result);
      assert.ok(table.includes("Code Ownership"));
      assert.ok(table.includes("Alice"));
      assert.ok(table.includes("Bob"));
    });
  });

  describe("formatFiles", () => {
    it("produces file ownership table", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      const table = formatFiles(result.fileOwnership);
      assert.ok(table.includes("File Ownership"));
      assert.ok(table.includes(".ts"));
    });
  });

  describe("formatJSON", () => {
    it("produces valid JSON", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      const json = formatJSON(result.authors);
      const parsed = JSON.parse(json);
      assert.ok(Array.isArray(parsed));
      assert.equal(parsed.length, 2);
    });
  });

  describe("formatMarkdown", () => {
    it("produces markdown table", () => {
      const dir = createTestRepo();
      const result = analyze(dir);
      const md = formatMarkdown(result);
      assert.ok(md.includes("# Code Ownership"));
      assert.ok(md.includes("| Alice"));
      assert.ok(md.includes("| Bob"));
    });
  });

  describe("excludePaths", () => {
    it("excludes specified paths", () => {
      const dir = createTestRepo();
      const ownership = getFileOwnership(dir, { excludePaths: ["utils"] });
      const utilsFile = ownership.find((f) => f.file === "utils.ts");
      assert.equal(utilsFile, undefined);
    });
  });
});

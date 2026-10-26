import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "release-files.json"), "utf8"),
);
assert.equal(
  new Set(manifest.files).size,
  manifest.files.length,
  "Duplicate release file",
);
for (const relative of manifest.files) {
  assert(
    !path.isAbsolute(relative) && !relative.split("/").includes(".."),
    "Unsafe release path",
  );
  assert(
    !/(^|\/)(work|node_modules|\.git)(\/|$)|\.env|\.DS_Store/.test(relative),
    "Private/scratch file in release",
  );
  const file = path.resolve(root, relative);
  assert(file.startsWith(root + path.sep));
  assert(fs.statSync(file).isFile(), `Missing ${relative}`);
  if (/\.(js|mjs|md|html|json|ya?ml|css|py)$/.test(file)) {
    const text = fs.readFileSync(file, "utf8");
    assert(
      !/\/Users\/|[A-Z]:\\Users\\/.test(text),
      `Personal absolute path in ${relative}`,
    );
    assert(
      !/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/.test(
        text,
      ),
      `Credential-like data in ${relative}`,
    );
  }
}
const data = JSON.parse(
  fs.readFileSync(path.join(root, "data/map.json"), "utf8"),
);
const raw = gunzipSync(
  fs.readFileSync(path.join(root, "data/oxford.osm.xml.gz")),
);
assert.equal(
  createHash("sha256").update(raw).digest("hex"),
  data.meta.rawSHA256,
  "OSM source hash mismatch",
);
for (const name of ["data/results.json", "data/results-dossier.json"]) {
  const result = JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  assert.equal(result.runs.length, 600);
  assert.equal(result.rows.length, 6);
  assert(result.rows.every((r) => r.runs === 100));
}
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(page.includes("openstreetmap.org/copyright"), "Missing map attribution");
const license = fs.readFileSync(path.join(root, "data/ODbL-1.0.html"), "utf8");
assert(
  !/<script|<iframe|<link[^>]+(?:src|href)=/i.test(license),
  "Active upstream assets in offline license",
);
assert(
  fs
    .readFileSync(path.join(root, "data/ODbL-1.0.txt"), "utf8")
    .includes("10.0 General"),
);
console.log(
  `Release verified: ${manifest.files.length} allowed files; OSM source integrity; 1,200 experiment rows; offline license; no matched local paths or credential patterns.`,
);

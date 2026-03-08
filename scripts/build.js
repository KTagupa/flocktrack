const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceFile = path.join(root, "index.source.html");
const outputFile = path.join(root, "index.html");
const swSourceFile = path.join(root, "sw.source.js");
const swOutputFile = path.join(root, "sw.js");
const generatedHtmlComment = "<!-- Generated from index.source.html. Edit source, then run npm run build. -->";
const generatedSwComment = "// Generated from sw.source.js. Edit source, then run npm run build.";
const requiredAssetRefs = [
  "manifest.webmanifest",
  "assets/icons/pens-nest-chicks-icon.png",
  "assets/pwa/icon-192.png",
  "assets/pwa/icon-512.png",
  "assets/stages/broiler.png",
  "assets/stages/chick.png",
  "assets/stages/egg.png",
  "assets/stages/grower.png",
  "assets/stages/layer.png",
  "assets/stages/pullet.png",
  "assets/stages/retired.png",
  "assets/stages/rooster.png"
];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readBuffer(filePath) {
  return fs.readFileSync(filePath);
}

function normalizeRefPath(refPath) {
  return refPath.replace(/\\/g, "/");
}

function resolveFromRoot(refPath) {
  return path.resolve(root, refPath);
}

function isLocalRef(refPath) {
  return !!refPath && !/^(?:[a-z]+:)?\/\//i.test(refPath) && !refPath.startsWith("data:") && !refPath.startsWith("#");
}

function uniqueRefs(refPaths) {
  const seen = new Set();
  return refPaths.filter(refPath => {
    if (seen.has(refPath)) return false;
    seen.add(refPath);
    return true;
  });
}

function ensureFileExists(refPath) {
  const filePath = resolveFromRoot(refPath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${refPath}`);
  return filePath;
}

function collectAssetRefsFromHtml(html) {
  const refs = [];
  const attrPattern = /<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g;
  let match = attrPattern.exec(html);
  while (match) {
    const refPath = normalizeRefPath(String(match[1] || "").trim());
    if (isLocalRef(refPath)) refs.push(refPath);
    match = attrPattern.exec(html);
  }
  return refs;
}

function addGeneratedComment(html) {
  if (!/^<!DOCTYPE html>/i.test(html)) {
    throw new Error("Source HTML must start with <!DOCTYPE html>.");
  }
  return html.replace(/^<!DOCTYPE html>\s*/i, `<!DOCTYPE html>\n${generatedHtmlComment}\n`);
}

function buildIndexHtml() {
  let html = readText(sourceFile);
  html = addGeneratedComment(html);
  if (!html.endsWith("\n")) html += "\n";
  fs.writeFileSync(outputFile, html);
  return html;
}

function buildPrecacheRefs(sourceHtml) {
  const refs = uniqueRefs(["index.html", ...collectAssetRefsFromHtml(sourceHtml), ...requiredAssetRefs]);
  refs.forEach(ensureFileExists);
  return refs;
}

function buildCacheVersion(indexHtml, swTemplate, precacheRefs) {
  const hash = crypto.createHash("sha256");
  hash.update(indexHtml);
  hash.update(swTemplate);
  precacheRefs.filter(refPath => refPath !== "index.html").forEach(refPath => {
    hash.update(readBuffer(resolveFromRoot(refPath)));
  });
  return hash.digest("hex").slice(0, 12);
}

function buildServiceWorker(indexHtml, precacheRefs) {
  const swTemplate = readText(swSourceFile);
  const cacheVersion = buildCacheVersion(indexHtml, swTemplate, precacheRefs);
  let swText = swTemplate.replace("__CACHE_VERSION__", cacheVersion).replace("__PRECACHE_URLS__", JSON.stringify(precacheRefs, null, 2));
  swText = `${generatedSwComment}\n${swText}`;
  if (!swText.endsWith("\n")) swText += "\n";
  fs.writeFileSync(swOutputFile, swText);
}

function build() {
  const indexHtml = buildIndexHtml();
  const sourceHtml = readText(sourceFile);
  const precacheRefs = buildPrecacheRefs(sourceHtml);
  buildServiceWorker(indexHtml, precacheRefs);
}

build();

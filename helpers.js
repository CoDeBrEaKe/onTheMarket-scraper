const zlib = require("zlib");
const cheerio = require("cheerio");

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isPropertyUrl(url) {
  return /^https:\/\/www\.onthemarket\.com\/details\/\d+\/?/.test(url);
}

function extractUrlsFromSitemap(data) {
  if (data.urlset && data.urlset.url) {
    return toArray(data.urlset.url).map((item) => item.loc);
  }
  return [];
}

function extractPropertyUrlsFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const links = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const fullUrl = absoluteUrl(href, pageUrl);
    if (fullUrl && isPropertyUrl(fullUrl)) links.push(fullUrl);
  });

  return [...new Set(links)];
}

function responseToText(data) {
  const buffer = Buffer.from(data);
  const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  if (isGzip) return zlib.gunzipSync(buffer).toString("utf8");
  return buffer.toString("utf8");
}

module.exports = {
  absoluteUrl,
  toArray,
  isPropertyUrl,
  extractUrlsFromSitemap,
  extractPropertyUrlsFromHtml,
  responseToText,
};

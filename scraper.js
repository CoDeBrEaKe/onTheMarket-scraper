const { XMLParser } = require("fast-xml-parser");
const { axiosInstance, buildRequestOptions } = require("./client");
const {
  isPropertyUrl,
  extractUrlsFromSitemap,
  extractPropertyUrlsFromHtml,
  responseToText,
} = require("./helpers");
const { scrapeProperty } = require("./scrapeProperty");
const { saveProperty, propertyExists } = require("./db");

const ROBOTS_URL = "https://www.onthemarket.com/robots.txt";

async function getSitemapsFromRobots() {
  const res = await axiosInstance.get(ROBOTS_URL, buildRequestOptions());
  return res.data
    .split("\n")
    .filter((line) => line.toLowerCase().startsWith("sitemap:"))
    .filter((line) => line.includes("for_sale"))
    .map((line) => line.replace(/sitemap:/i, "").trim());
}

async function parseXmlUrl(url) {
  const zlib = require("zlib");
  const parser = new XMLParser();
  const isGzip = url.endsWith(".gz");

  // Fetch phase — separated from parse so errors don't bleed into each other
  let xmlText;
  try {
    const opts = {
      ...buildRequestOptions(),
      // .gz files must come back as raw bytes so we can decompress them
      responseType: isGzip ? "arraybuffer" : "text",
    };
    const res = await axiosInstance.get(url, opts);
    if (!res.data || res.data.length === 0)
      throw new Error("Empty response body");
    xmlText = isGzip
      ? zlib.gunzipSync(Buffer.from(res.data)).toString("utf8")
      : res.data;
  } catch (e) {
    // Only fall back to Puppeteer for network errors, not .gz files (browsers can't open them)
    if (isGzip) throw new Error(`Cannot fetch ${url}: ${e.message}`);
    console.log(
      "Axios request failed, falling back to browser fetch:",
      e.message,
    );

    const puppeteer = require("puppeteer");
    const uaOpts = buildRequestOptions();
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(uaOpts.headers["User-Agent"]);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      xmlText = await page.content();
      await browser.close();
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  return parser.parse(xmlText);
}

async function getPropertyLinksFromSearchPage(url) {
  const res = await axiosInstance.get(url, buildRequestOptions());
  const html = responseToText(res.data);
  return extractPropertyUrlsFromHtml(html, url);
}

async function collectPropertyUrls(sitemaps) {
  let propertyUrls = [];

  for (const sitemap of sitemaps) {
    console.log("\n--- Reading sitemap:", sitemap);

    const xml = await parseXmlUrl(sitemap);
    const urls = extractUrlsFromSitemap(xml);
    const directLinks = urls.filter(isPropertyUrl);

    console.log("direct property links found:", directLinks.length);
    propertyUrls.push(...directLinks);

    if (directLinks.length === 0 && sitemap.includes("sitemap_for_sale")) {
      console.log("No direct details links. Expanding search pages...");

      for (const pageUrl of urls.slice(0, 10)) {
        console.log("opening search page:", pageUrl);
        try {
          const linksFromPage = await getPropertyLinksFromSearchPage(pageUrl);
          console.log("details found in page:", linksFromPage.length);
          propertyUrls.push(...linksFromPage);
        } catch (err) {
          console.log("failed search page:", pageUrl, "-", err.message);
        }
        if (propertyUrls.length >= 50) break;
      }
    }
  }

  return [...new Set(propertyUrls)];
}

async function main() {
  try {
    const sitemaps = await getSitemapsFromRobots();
    console.log("sitemaps found:", sitemaps.length);
    if (!sitemaps.length) throw new Error("No sitemap URL found");

    const propertyUrls = await collectPropertyUrls(sitemaps);
    console.log("\n==============================");
    console.log("TOTAL PROPERTY URLS:", propertyUrls.length);
    console.log("==============================\n");

    let saved = 0;
    let skipped = 0;

    for (const url of propertyUrls) {
      if (propertyExists(url)) {
        skipped++;
        continue;
      }

      try {
        const data = await scrapeProperty(url);
        saveProperty(data);
        saved++;
        console.log(`[${saved}] saved: ${url}`);
        console.log(`       address: ${data.address}`);
        console.log(`       price:   ${data.price}`);
        console.log(`       type:    ${data.type}  beds: ${data.beds}`);
        console.log(`       agent:   ${data.agent}`);
        console.log(`       images:  ${(data.images || []).length}`);
      } catch (err) {
        console.log(`failed: ${url} — ${err.message}`);
      }
    }

    console.log(`\nDone. saved=${saved} skipped=${skipped}`);
  } catch (err) {
    console.error(err);
  }
}

main();

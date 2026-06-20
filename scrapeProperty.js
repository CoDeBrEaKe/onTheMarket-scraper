const cheerio = require("cheerio");
const { axiosInstance, buildRequestOptions } = require("./client");

async function fetchHtml(url) {
  const opts = buildRequestOptions();

  try {
    const res = await axiosInstance.get(url, opts);
    if (res.data && res.data.length > 0) return res.data;
  } catch (e) {
    console.log(
      `Axios failed for ${url}: ${e.message}, falling back to browser`,
    );
  }

  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent(buildRequestOptions().headers["User-Agent"]);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  try {
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    const content = await page.content();
    await browser.close();
    return content;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

function extractFromNextData($) {
  const scriptTag = $("#__NEXT_DATA__").html();
  if (!scriptTag) return null;

  let nextData;
  try {
    nextData = JSON.parse(scriptTag);
  } catch {
    return null;
  }

  // Data lives in initialReduxState, not pageProps (pageProps is empty on this site)
  const redux = nextData?.props?.initialReduxState;
  if (!redux) return null;

  // The property details page stores the listing under one of these keys
  const p =
    redux.property ||
    redux.listing ||
    redux.propertyDetails ||
    redux.details ||
    null;

  if (!p) {
    console.log("  [debug] No property key found in Redux state");
    return null;
  }

  const price = p.price || p.priceRaw || null;
  const address = p.displayAddress || null;
  const type = p.humanisedPropertyType || null;
  const beds = p.bedrooms || null;
  const description = p.description || p.summary || null;
  const agent = redux.agent?.name || p.agent?.name || null;

  const rawImages = p.images || [];
  const images = rawImages
    .map((img) => img.url || img.src || (typeof img === "string" ? img : null))
    .filter(Boolean);

  return { price, address, type, beds, description, agent, images };
}

async function scrapeProperty(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const data = extractFromNextData($);

  return { url, ...data };
}

module.exports = { scrapeProperty };

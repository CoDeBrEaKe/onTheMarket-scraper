const axios = require("axios");
const { wrapper: axiosCookieJar } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const cookieJar = new CookieJar();
const axiosInstance = axiosCookieJar(axios.create({ jar: cookieJar }));

function buildRequestOptions() {
  return {
    maxRedirects: 10,
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
    },
  };
}

module.exports = { axiosInstance, buildRequestOptions };

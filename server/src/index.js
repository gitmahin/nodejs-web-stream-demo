import express, { response } from "express";
import cors from "cors";
import puppeterStealthPlugin from "puppeteer-extra-plugin-stealth";
import puppExtra from "puppeteer-extra";
import puppAdblocker from "puppeteer-extra-plugin-adblocker";
import { Readable, Writable } from "node:stream";

const app = express();
app.use(
  cors({
    origin: "*",
  }),
);

puppExtra.use(puppeterStealthPlugin());
puppExtra.use(puppAdblocker({ blockTrackers: true }));
app.get("/scrap", async (req, res) => {
  console.log("Scrapping initialized success");

  //   Setup puppeter browser
  const browser = await puppExtra.launch({
    browser: "chrome",
    headless: false,
  });
  const context = await browser.createBrowserContext();
  const page = await context.newPage({
    type: "tab",
  });
  page.goto("https://skybuybd.com/shop/purse");
  console.log("Scrapping the web");

  await page.waitForSelector(".productList > div > a", { timeout: 30000 });

  const products = await page.$$eval(".productList > div > a", (anchors) => {
    return anchors.map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";

      return {
        link: href,
        image:
          anchor.querySelector(".productImage")?.getAttribute("src") ?? null,
        title:
          anchor.querySelector(".productTitle")?.textContent?.trim() ?? null,
        sale_price:
          anchor.querySelector(".productPrice")?.textContent?.trim() ?? null,
        regular_price:
          anchor.querySelector(".prevPrice")?.textContent?.trim() ?? null,
      };
    });
  });

  context.close();
  // console.log(data);

  async function* getProducts() {
    for (const product of products) {
      yield JSON.stringify(product);
    }
  }
  const readableStream = Readable.from(getProducts());

  await Readable.toWeb(readableStream)
    .pipeThrough(
      new TransformStream({
        async transform(chunk, controller) {
          const data = JSON.parse(chunk);
          console.log(data);
          controller.enqueue(chunk);
        },
      }),
    )
    .pipeTo(Writable.toWeb(res));
});

app.listen(5000, () => {
  console.log("server is running on port", 5000);
});

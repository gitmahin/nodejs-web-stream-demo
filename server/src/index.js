import express from "express";
import cors from "cors";
import puppeterStealthPlugin from "puppeteer-extra-plugin-stealth";
import puppExtra from "puppeteer-extra";
import puppAdblocker from "puppeteer-extra-plugin-adblocker";
import { Readable, Writable } from "node:stream";
import { TransformStream } from "node:stream/web";

const app = express();
app.use(
  cors({
    origin: "*",
  }),
);

puppExtra.use(puppeterStealthPlugin());
puppExtra.use(puppAdblocker({ blockTrackers: true }));

const convertToNdJSON = () => {
  return new TransformStream({
    buffer: "",
    /**
     * Transforms incoming data chunks into NDJSON (Newline Delimited JSON) format.
     * It buffers the input, splits it by newlines,
     * and enqueues the stringified data to the stream controller.
     * @param chunk - The data chunk from the generator.
     * @param controller - The stream controller.
     */
    async transform(chunk, controller) {
      /**
       * add the incoming chunk to buffer.
       * We add a newline "\n" to ensure there's a proper newline separator between data objects.
       */
      this.buffer += JSON.stringify(chunk) + "\n";

      /**
       * look for the first newline character in the buffer.
       * indexOf returns the position (index) of the character, or -1 if not found.
       */
      let boundary = this.buffer.indexOf("\n");
      while (boundary !== -1) {
        // take everything from the start of the buffer up to the newline.
        const jsonStr = this.buffer.substring(0, boundary);

        /**
         * remove the part we just extracted. also the newline itself.
         * The buffer now only contains the "leftover" data for the next round.
         */
        this.buffer = this.buffer.substring(boundary + 1);

        if (jsonStr.trim()) {
          console.log("data", JSON.parse(jsonStr));
          // send the clean json with new line delimeted to the client.
          controller.enqueue(jsonStr + "\n");
        }

        /**
         * Look for the next newline in the remaining buffer.
         * If found, the loop repeats; if not, the loop ends and we wait for more chunks.
         */
        boundary = this.buffer.indexOf("\n");
      }
    },
    flush(controller) {
      // -- Handle any remaining data in buffer
      if (this.buffer.trim()) {
        controller.enqueue(this.buffer + "\n");
      }
    },
  });
};

// -- Generator function for scrapping data
async function* scrapProducts(number_of_pages, page) {
  console.log("Scrapping the web");
  for (let i = 0; i < number_of_pages; i++) {
    try {
      // -- ⚠️ Dont do this. it will increase memory usage, rather click pagination manualy via locator
      // await page.goto(`https://skybuybd.com/shop/purse?page=${i + 1}`, {
      //   waitUntil: "networkidle2",
      // });

      // -- Wait for products on current page
      await page.waitForSelector(".productList > div > a", {
        timeout: 10000,
      });

      // -- Wait while loading website UI
      await page.waitForFunction(
        () => {
          const links = document.querySelectorAll(".productList > div > a");

          if (links.length === 0) return false;

          // -- check if title contains "Sample".
          // As the specified website add Sample text in product title during loading.
          const hasSample = Array.from(links).some((a) =>
            a.querySelector(".productTitle")?.textContent?.includes("Sample"),
          );

          return !hasSample;
        },
        { timeout: 10000 },
      );

      // -- yield current page data
      yield await page.$$eval(".productList > div > a", (anchors) => {
        return anchors.map((anchor) => {
          const href = anchor.getAttribute("href") ?? "";
          return {
            link: href,
            image:
              anchor.querySelector(".productImage")?.getAttribute("src") ??
              null,
            title:
              anchor.querySelector(".productTitle")?.textContent?.trim() ??
              null,
            sale_price:
              anchor.querySelector(".productPrice")?.textContent?.trim() ??
              null,
            regular_price:
              anchor.querySelector(".prevPrice")?.textContent?.trim() ?? null,
          };
        });
      });
      console.log(`Page ${i + 1} scraped`);

      // -- Don't click on the last iteration (pagination)
      if (i < number_of_pages - 1) {
        // -- Wait for next button to be available and click
        await page.waitForSelector(".ant-pagination-next", {
          timeout: 5000,
        });

        // -- Click next page
        (await page.locator(".ant-pagination-next").click(),
          console.log(`Page ${i + 2} loaded`));
      }
    } catch (error) {
      console.error(`Error on page ${i + 1}:`, error.message);
      break; // -- stop generator on error
    }
  }
}

app.get("/scrap", async (req, res) => {
  try {
    console.log("Scrapping initialized success");
    const browser = await puppExtra.launch({
      browser: "chrome",
      headless: true,
    });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.goto("https://skybuybd.com/shop/purse", {
      waitUntil: "networkidle2",
    });

    // -- Streaming
    const readableStream = Readable.from(scrapProducts(5, page));
    try {
      await Readable.toWeb(readableStream)
        .pipeThrough(convertToNdJSON())
        .pipeTo(Writable.toWeb(res));
    } catch (error) {
      console.log("Stream error: ", error);
    } finally {
      await context.close();
    }
  } catch (error) {
    console.log("Http error: ", error);
  } finally {
    res.end();
  }
});

app.listen(5000, () => {
  console.log("server is running on port", 5000);
});

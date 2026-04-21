import express, { response } from "express";
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
app.get("/scrap", async (req, res) => {
  console.log("Scrapping initialized success");

  //   Setup puppeter browser
  const browser = await puppExtra.launch({
    browser: "chrome",
    headless: true,
  }); 
  const context = await browser.createBrowserContext();
  const page = await context.newPage({
    type: "tab",
  });
  await page.goto("https://skybuybd.com/shop/purse", {
    waitUntil: "networkidle2",
  });
  console.log("Scrapping the web");

  async function* getProducts(number_of_products) {
    for (let i = 0; i < number_of_products; i++) {
      try {
        // Wait for products on current page
        await page.waitForSelector(".productList > div > a", {
          timeout: 10000,
        });
        await new Promise((r) => setTimeout(r, 2000));

        // Yield current page data
        const data = await page.$$eval(".productList > div > a", (anchors) => {
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
        console.log(`✅ Page ${i + 1} scraped: ${data.length} products`);
        yield data;

        // Don't click on the last iteration
        if (i < number_of_products - 1) {
          // Wait for next button to be available and click
          await page.waitForSelector(
            ".ant-pagination-next:not(.ant-pagination-disabled)",
            { timeout: 5000 },
          );

          // Click and wait for new products to load
          await Promise.all([
            page.waitForFunction(
              () => {
                // Wait for stale products to be replaced
                return (
                  document.querySelectorAll(".productList > div > a").length > 0
                );
              },
              { timeout: 10000 },
            ),
            page.locator(".ant-pagination-next").click(),
          ]);

          // Small buffer for re-render
          await new Promise((r) => setTimeout(r, 500));
          console.log(`✅ Page ${i + 2} loaded`);
        }
      } catch (error) {
        console.error(`💥 Error on page ${i + 1}:`, err.message);
        break; // stop generator cleanly instead of crashing
      }
    }
  }

  // console.log(data);

  const readableStream = Readable.from(getProducts(10));
  let counter = 0;
  let length = 0;
  try {
    // res.setHeader("Content-Type", "text/event-stream"); // SSE format
    // res.setHeader("Cache-Control", "no-cache, no-transform"); // no-transform is key
    // res.setHeader("X-Accel-Buffering", "no"); // disables nginx/proxy buffering
    // res.setHeader("Connection", "keep-alive");
    // res.flushHeaders();
    await Readable.toWeb(readableStream)
      .pipeThrough(
        new TransformStream({
          buffer: "",
          async transform(chunk, controller) {
            this.buffer += JSON.stringify(chunk) + "\n";

            let boundary = this.buffer.indexOf("\n");
            while (boundary !== -1) {
              const jsonStr = this.buffer.substring(0, boundary);
              this.buffer = this.buffer.substring(boundary + 1);

              if (jsonStr.trim()) {
                console.log("data", JSON.parse(jsonStr));
                length += JSON.parse(jsonStr).length;
                counter++;
                controller.enqueue(jsonStr + "\n"); // send to client as string
              }

              boundary = this.buffer.indexOf("\n");
            }
          },
          flush(controller) {
            // Handle any remaining data in buffer
            if (this.buffer.trim()) {
              controller.enqueue(this.buffer + "\n");
            }
          },
        }),
      )
      .pipeTo(Writable.toWeb(res));
  } catch (error) {
    console.log("error", error);
  } finally {
    console.log("counter", counter);
    console.log("length", length);
    res.end();
    await context.close();
  }
});

// app.get("/scrap", async (req, res) => {
//   res.writeHead(200, {
//     "Content-Type": "application/x-ndjson",
//     "Transfer-Encoding": "chunked",
//     "Connection": "keep-alive",
//   });

//   const browser = await puppExtra.launch({ headless: true });
//   const context = await browser.createBrowserContext();

//   try {
//     const page = await context.newPage();
//     await page.goto("https://skybuybd.com");

//    async function* getProducts(number_of_products) {
//     for (let i = 0; i < number_of_products; i++) {
//       try {
//         // Wait for products on current page
//         await page.waitForSelector(".productList > div > a", {
//           timeout: 10000,
//         });
//         await new Promise((r) => setTimeout(r, 2000));

//         // Yield current page data
//         const data = await page.$$eval(".productList > div > a", (anchors) => {
//           return anchors.map((anchor) => {
//             const href = anchor.getAttribute("href") ?? "";
//             return {
//               link: href,
//               image:
//                 anchor.querySelector(".productImage")?.getAttribute("src") ??
//                 null,
//               title:
//                 anchor.querySelector(".productTitle")?.textContent?.trim() ??
//                 null,
//               sale_price:
//                 anchor.querySelector(".productPrice")?.textContent?.trim() ??
//                 null,
//               regular_price:
//                 anchor.querySelector(".prevPrice")?.textContent?.trim() ?? null,
//             };
//           });
//         });
//         console.log(`✅ Page ${i + 1} scraped: ${data.length} products`);
//         yield data;

//         // Don't click on the last iteration
//         if (i < number_of_products - 1) {
//           // Wait for next button to be available and click
//           await page.waitForSelector(
//             ".ant-pagination-next:not(.ant-pagination-disabled)",
//             { timeout: 5000 },
//           );

//           // Click and wait for new products to load
//           await Promise.all([
//             page.waitForFunction(
//               () => {
//                 // Wait for stale products to be replaced
//                 return (
//                   document.querySelectorAll(".productList > div > a").length > 0
//                 );
//               },
//               { timeout: 10000 },
//             ),
//             page.locator(".ant-pagination-next").click(),
//           ]);

//           // Small buffer for re-render
//           await new Promise((r) => setTimeout(r, 500));
//           console.log(`✅ Page ${i + 2} loaded`);
//         }
//       } catch (error) {
//         console.error(`💥 Error on page ${i + 1}:`, error.message);
//         break; // stop generator cleanly instead of crashing
//       }
//     }
//   }

//     await pipeline(
//       Readable.from(getProducts(10)),
//       async function* (source) {
//         for await (const chunk of source) {
//           console.log(chunk)
//           yield JSON.stringify(chunk) + "\n";
//         }
//       },
//       res
//     );
//   } catch (error) {
//     // Check if the error is just a normal client disconnect
//     if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
//       console.log("👋 Client disconnected early. Stopping scraper.");
//     } else {
//       console.error("💥 Real Stream Error:", error);
//     }
//   } finally {
//     // This part is critical: ensure the browser ALWAYS closes
//     // when the pipeline ends (success OR disconnect)
//     await context.close();
//     await browser.close();
//     if (!res.writableEnded) res.end();
//   }
// });
app.listen(5000, () => {
  console.log("server is running on port", 5000);
});

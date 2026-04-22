# 🌊 Node.js Web Streams — Live Scraping Demo

A full-stack demonstration of **Node.js Web Streams API** for real-time, memory-efficient data streaming from a scraper to a React UI - with zero buffering on the server side.

---

## What This Demonstrates

This project shows how to pipe data end-to-end using the **Nodejs Stream**, without waiting for all data to be collected before sending it to the client.

```
Puppeteer (AsyncGenerator)
       ↓
  Readable.from()          - Node.js readable stream from async generator
       ↓
  Readable.toWeb()         - Convert to WHATWG ReadableStream
       ↓
  TransformStream          - Serialize each page's products to NDJSON
       ↓
  Writable.toWeb(res)      - Pipe directly into Express HTTP response
       ↓  (HTTP / fetch)
  TextDecoderStream        - Decode binary chunks to string (browser)
       ↓
  TransformStream          - Parse NDJSON lines back to JS objects
       ↓
  WritableStream           - Write parsed products into React state
```

---

## Folder Structure

```
├── react-client/          # Vite + React frontend
│   └── src/
│       └── App.jsx        # Stream consumer UI
│
└── server/                # Express backend
    └── index.ts           # Puppeteer scraper + stream pipeline
```

---

## Key Concepts

### NDJSON (Newline Delimited JSON)
Each scraped page is serialized as one JSON line followed by `\n`. This lets the client parse results incrementally - one line = one complete chunk of data - without waiting for the full response.

```
[{"title":"Bag A",...}]\n
[{"title":"Bag B",...}]\n
```

### Server - `TransformStream` for serialization
```ts
new TransformStream({
  transform(chunk, controller) {
    this.buffer += JSON.stringify(chunk) + "\n";
    let boundary = this.buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = this.buffer.substring(0, boundary);
      this.buffer = this.buffer.substring(boundary + 1);
      if (line.trim()) controller.enqueue(line + "\n");
      boundary = this.buffer.indexOf("\n");
    }
  },
  flush(controller) {
    if (this.buffer.trim()) controller.enqueue(this.buffer + "\n");
  },
})
```
> `buffer` is stored on `this` inside the transformer — it persists across chunks and holds incomplete data between reads.

### Client - `TransformStream` for parsing
```ts
new TransformStream({
  transform(chunk, controller) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try { controller.enqueue(JSON.parse(line)); } catch {}
    }
  },
})
```
> Chunks arriving over HTTP may be split arbitrarily — the buffer ensures we only parse **complete** lines.

### Why `Readable.from()` + `Readable.toWeb()`?
Puppeteer's scraper is an `AsyncGenerator`. Node's `Readable.from()` wraps it in a Node.js stream, and `Readable.toWeb()` converts it to a [WHATWG](https://streams.spec.whatwg.org/) `ReadableStream` - making it compatible with `.pipeThrough()` and `.pipeTo()`.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Google Chrome installed (used by Puppeteer)

### Install & Run

**Puppeteer browser**
```bash
npx puppeteer browsers install chrome
```

**Server**
```bash
cd server
pnpm install
pnpm run dev        # or: npx ts-node index.ts
```

**Client**
```bash
cd react-client
pnpm install
pnpm run dev
```

Then open `http://localhost:5173` and click **Start Scraping**.

---

## How It Works - Step by Step

1. A `GET /scrap` request hits the Express server.
2. Puppeteer launches a headless Chrome and navigates to the target shop page.
3. An `async generator` (`getProducts`) scrapes each page and `yield`s an array of products, then clicks the pagination "next" button and repeats.
4. The generator is wrapped in a `Readable` stream and converted to a WHATWG `ReadableStream`.
5. A `TransformStream` serializes each yielded array to an NDJSON line and enqueues it.
6. The final stream is piped directly into the HTTP response - **data starts flowing to the client before all pages are scraped**.
7. In the browser, the response body is decoded, split by newlines, parsed as JSON, and appended to React state in real time.

---

## Notes & Caveats

- The scraper targets `skybuybd.com/shop/purse` - adjust the URL and selectors as needed.
- Products render **live** as each page is scraped; no need to wait for all 50 pages.
- The `buffer` property on `TransformStream` is a pattern for stateful transforms - it is not part of the `Transformer` interface spec, so TypeScript requires it to be managed outside the object or cast appropriately.
- Memory stays low because the generator `yield`s one page at a time, not all pages at once.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Scraping | Puppeteer Extra + Stealth Plugin + Adblocker |
| Server | Node.js, Express, WHATWG Streams (`node:stream/web`) |
| Client | React (Vite), WHATWG Streams (browser-native) |
| Data format | NDJSON over HTTP streaming |
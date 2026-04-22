"use client";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [productsCount, setProductsCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // -- Example 1
  // const handleStreamData = useCallback(async () => {
  //   const response = await fetch("http://localhost:5000/scrap");
  //   const reader = response.body!.getReader();
  //   const decoder = new TextDecoder();

  //   try {
  //     while (true) {
  //       const { done, value } = await reader.read();
  //       if (done) break;

  //       const chunk = JSON.parse(decoder.decode(value));
  //       setProducts(prev => [...prev, ...chunk]);
  //     }
  //   } catch (err) {
  //     console.error("Stream error:", err);
  //   } finally {
  //     reader.releaseLock();
  //   }
  // }, []);

  // -- Example 2. Recomended
  const handleStreamData = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/scrap");
      await response
        .body!.pipeThrough(new TextDecoderStream())
        .pipeThrough(
          new TransformStream({
            // 'buffer' is a custom property to store incomplete chunks between reads
            buffer: "",

            transform(chunk, controller) {
              // chunk arrives as string (after TextDecoderStream)
              // append to buffer because a chunk might be INCOMPLETE
              // e.g. chunk1: '[{"title":"foo' and chunk2: '"bar"}]\n'
              // we need to wait until we have a complete line
              this.buffer += chunk;

              // split by newline — each complete line is one JSON object
              const lines = this.buffer.split("\n");

              // remove and return the LAST element
              // the last element is always incomplete (no \n yet)
              // so we save it back to buffer for the next chunk
              this.buffer = lines.pop() ?? "";

              // now process only the COMPLETE lines
              for (const line of lines) {
                if (!line.trim()) continue; // skip empty lines

                try {
                  const product = JSON.parse(line); // parse complete JSON line

                  controller.enqueue(product);
                } catch {} // silently skip malformed JSON
              }
            },

            // handles any remaining data left in buffer that never got a \n
            flush(controller) {
              if (this.buffer.trim()) {
                try {
                  const product = JSON.parse(this.buffer);
                  controller.enqueue(product);
                } catch {}
              }
            },
          }as Transformer<string, any> & { buffer: string }) ,
        )
        .pipeTo(
          new WritableStream({
            write(chunk) {
              setProducts((prev) => {
                // -- Uncomment if you wanna show 20 products on each page
                // if (prev.length >= 20) {
                //   return [...prev, ...chunk].slice(-20);
                // }
                return [...prev, ...chunk];
              });
            },
          }),
        );
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // -- When pagination implemented
    // setProductsCount((prev) => prev + products.length);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [products]);

  return (
    <div className="p-5">
      <button
        className="bg-white text-black rounded-md px-10 py-2 font-medium hover:bg-gray-100 active:scale-[0.9] transition-all"
        onClick={handleStreamData}
        disabled={loading}
      >
        {loading ? "Scraping..." : "Click me"}
      </button>

      <div className="mt-3 text-lg text-black z-50 font-medium rounded-full fixed top-5 right-5 bg-white px-5 py-3">
        <span className="font-semibold">{products.length}</span> products loaded
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product, i) => (
          <a
            key={i}
            href={`https://skybuybd.com${product.link}`}
            target="_blank"
            className="border border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow"
          >
            {product.image && (
              <img
                src={product.image}
                alt={product.title ?? ""}
                className="w-full h-40 object-cover rounded-md"
              />
            )}
            <p className="font-medium mt-2 text-sm line-clamp-2">
              {product.title}
            </p>
            <div className="mt-1 flex gap-2 items-center">
              <span className="text-green-600 font-bold">
                {product.sale_price}
              </span>
              <span className="text-gray-400 line-through text-xs">
                {product.regular_price}
              </span>
            </div>
          </a>
        ))}
      </div>
      <div ref={bottomRef}></div>
    </div>
  );
}

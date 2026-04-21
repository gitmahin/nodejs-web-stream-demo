"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { buffer } from "stream/consumers";

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null)


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

  // -- Example 3. Recomended
  const handleStreamData = async () => {
    setLoading(true)
   try {
     const response = await fetch("http://localhost:5000/scrap");
     await response.body!.pipeThrough(new TextDecoderStream()).pipeTo(
       new WritableStream({
         write(chunk) {
           // never do heavy synchronous work inside write(). Keep it as fast as possible, just parse and set state.
           // dont use logging here.
           // it will cause stream to stop.
           // Why?
           //Because console.log is synchronous and blocking inside a WritableStream.write() — when you log a large object, it freezes the write method long enough that the stream controller times out and closes.
 
           // Also in Next.js dev mode, console.log triggers React's console interceptor (intercept-console-error.ts — you saw it in your stack traces) which causes a re-render, which cancels the ongoing stream.
 
           setProducts((prev) => [...prev, ...JSON.parse(chunk)]);
         },
       }),
     );
   } catch (error) {
    
   }finally{
     setLoading(false)
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"})
  })

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

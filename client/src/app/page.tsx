"use client";
import Image from "next/image";

export default function Home() {
  const handleScrap = async () => {
    const response = await fetch("http://localhost:5000/scrap");
    const data = await response.json();
    console.log(data);
  };
  return (
    <div className="p-5">
      <button className="bg-white text-black rounded-md px-10 py-2 font-medium hover:bg-gray-100 active:scale-[0.9] transition-all" onClick={handleScrap}>Click me</button>
    </div>
  );
}

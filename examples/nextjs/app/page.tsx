"use client";
import React, { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState({
    success: true,
    limit: 10,
    remaining: 10
  });
  const [message, setMessage] = useState("")

  const handleClick = async () => {
    try {
      const response = await fetch(`/api`);
      const data = await response.text();
      setStatus(JSON.parse(data));
    } catch (error) {
      console.error("Error fetching data:", error);
      setStatus({
        success: false,
        limit: -1,
        remaining: -1
      });
      setMessage(`Error fetching data. Make sure that env variables are set as explained in the README file.`,)
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="absolute top-1/3 text-center">
        <p className="text-lg">This app is an example of rate limiting an API on Vercel Edge.</p>
        <p className="text-lg">Click the button below to call the API and get the rate limit status.</p>
        <p className="text-lg pt-5">{message}</p>
      </div>
      <div className="absolute top-1/2 grid grid-cols-3 gap-8 justify-center transform -translate-y-1/2">
        {Object.entries(status).map(([key, value]) => (
          <div key={key} className="text-center">
            <div className="font-semibold">{key}</div>
            <div>{JSON.stringify(value)}</div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-1/3">
        <button onClick={handleClick} className="bg-[#dee2e3] hover:bg-[#9aa6a9] transition border-black text-[#5a6769] font-semibold py-2 px-4 rounded-lg">
          Test Rate Limit
        </button>
      </div>
    </div>
  );
}

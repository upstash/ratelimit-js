import { useEffect, useState } from "react";

function HomePage() {
  const [n, setN] = useState("");
  const [headers, setHeaders] = useState<Record<string, string | null>>({});

  useEffect(() => {}, []);

  const generate = async () => {
    const res = await fetch("/api/rng");
    setHeaders({
      "RateLimit-Limit": res.headers.get("RateLimit-Limit"),
      "RateLimit-Remaining": res.headers.get("RateLimit-Remaining"),
      "RateLimit-Reset": res.headers.get("RateLimit-Reset"),
    });
    if (res.ok) {
      setN(await res.text());
    } else {
      setN("");
      alert(
        `Ratelimit reached, try again after ${new Date(
          parseInt(res.headers.get("RateLimit-Reset")!)
        ).toLocaleString()}`
      );
    }
  };

  return (
    <div>
      <h2>Random number: {n}</h2>
      <button type="button" onClick={generate}>
        Get new number
      </button>
      <h3>Headers</h3>
      <table>
        {Object.entries(headers).map(([key, value]) => (
          <tr key={key}>
            <td>{key}</td>
            <td>{value}</td>
          </tr>
        ))}
      </table>
    </div>
  );
}

export default HomePage;

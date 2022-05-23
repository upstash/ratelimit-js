import "styles/globals.css";

import React from "react";
import type { AppProps } from "next/app";
import Header from "components/Header";
import ReadBlogPost from "components/ReadBlogPost";
import Head from "next/head";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header
        breadcrumbOptions={{
          data: [
            {
              name: "ratelimit",
              url: "https://github.com/upstash/ratelimit",
            },
          ],
        }}
      />

      {
        /*<ReadBlogPost>
        This is a sample project for the blogpost{" "}
        <a
          className="text-primary-600"
          target="_blank"
          rel="noopener noreferrer"
          href="https://blog.upstash.com/nextjs-caching-with-redis"
        >
          Example Post
        </a>
      </ReadBlogPost>*/
      }

      <div className="w-full max-w-3xl px-6 mx-auto py-14">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default MyApp;

import React from "react";

export default function ReadBlogPost({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-gray-100 p-4 text-center">{children}</div>;
}

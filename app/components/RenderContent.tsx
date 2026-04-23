"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Props = {
  children: string;
  className?: string;
  inline?: boolean;
};

export default function RenderContent({ children, className, inline = false }: Props) {
  const Tag = inline ? "span" : "div";

  return (
    <Tag className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // inline elements — no block wrappers
          p: ({ children }) => <span>{children}</span>,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ""} className="max-w-full rounded my-1 inline-block" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </Tag>
  );
}

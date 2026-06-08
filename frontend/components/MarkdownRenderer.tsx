import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidDiagram from './MermaidDiagram';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="bg-dark-600 px-1.5 py-0.5 rounded text-xs font-mono text-primary-300"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            const language = className?.replace('language-', '') || '';
            if (language === 'mermaid') {
              return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
            }
            return (
              <pre className="bg-dark-800 border border-dark-500 rounded-lg p-3 overflow-x-auto my-2">
                <code className={`text-xs font-mono text-gray-300 ${className || ''}`} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:text-primary-300 underline"
              >
                {children}
              </a>
            );
          },
          ul({ children }) {
            return <ul className="list-disc list-inside space-y-1 my-2 text-gray-200">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside space-y-1 my-2 text-gray-200">{children}</ol>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold my-3 text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold my-2 text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold my-2 text-white">{children}</h3>;
          },
          p({ children }) {
            return <p className="my-1.5 text-gray-200">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary-500 pl-4 my-2 text-gray-400 italic">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="border-dark-500 my-4" />;
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="min-w-full border-collapse border border-dark-500 text-sm">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-dark-500 px-3 py-2 bg-dark-700 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-dark-500 px-3 py-2">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

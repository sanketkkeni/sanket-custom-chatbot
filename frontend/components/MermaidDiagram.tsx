import { useEffect, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#0ea5e9',
    primaryTextColor: '#fff',
    primaryBorderColor: '#0284c7',
    lineColor: '#38bdf8',
    secondaryColor: '#1a1a24',
    tertiaryColor: '#111118',
  },
});

export default function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
    mermaid
      .render(id, chart)
      .then((result) => setSvg(result.svg))
      .catch(() => setError(true));
  }, [chart]);

  if (error) {
    return (
      <pre className="text-xs text-red-400 whitespace-pre-wrap bg-dark-800 p-2 rounded my-2">
        {chart}
      </pre>
    );
  }

  return (
    <div
      className="my-3 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

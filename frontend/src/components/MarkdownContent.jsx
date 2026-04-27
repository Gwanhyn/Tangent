import { Clipboard, Check } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { useCopy } from '../i18n';

function CodeBlock({ className = '', children }) {
  const copyText = useCopy();
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className)?.[1] || 'text';
  const raw = String(children || '').replace(/\n$/, '');
  const grammar = Prism.languages[language] || Prism.languages.markup;
  const highlighted = grammar ? Prism.highlight(raw, grammar, language) : raw;

  const copy = async () => {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{language}</span>
        <button type="button" onClick={copy}>
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? copyText.chat.copied : copyText.chat.copy}
        </button>
      </div>
      <pre>
        <code
          className={className}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

export default function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ inline, className, children, ...props }) {
          if (inline) {
            return <code className="inline-code" {...props}>{children}</code>;
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
      }}
    >
      {content || ''}
    </ReactMarkdown>
  );
}

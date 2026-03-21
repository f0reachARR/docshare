import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className='prose prose-sm max-w-none dark:prose-invert'>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </div>
  );
}

function compactQuestion(content) {
  const text = (content || '').replace(/\s+/g, ' ').trim();
  return text.length > 20 ? `${text.slice(0, 20)}...` : text;
}

export default function ContextTimeline({ messages, label, onJump }) {
  const nodes = messages.filter((message) => message.role === 'user' && !message.is_hidden);

  if (nodes.length === 0) {
    return null;
  }

  return (
    <nav className="context-timeline" aria-label={label}>
      <div className="timeline-track" />
      {nodes.map((message, index) => {
        const text = compactQuestion(message.content);
        return (
          <button
            aria-label={text}
            className="timeline-node"
            key={message.id}
            onClick={() => onJump(message.id)}
            style={{ '--node-index': index, '--node-count': Math.max(nodes.length - 1, 1) }}
            title={text}
            type="button"
          >
            <span>{text}</span>
          </button>
        );
      })}
    </nav>
  );
}

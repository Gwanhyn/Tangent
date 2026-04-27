import { Bot, UserRound } from 'lucide-react';

export default function MessageBubble({ message, branch }) {
  const isUser = message.role === 'user';
  return (
    <article className={`message-row ${isUser ? 'message-row-user' : ''}`}>
      <div className={`message-avatar ${isUser ? 'avatar-user' : branch ? 'avatar-branch' : 'avatar-ai'}`}>
        {isUser ? <UserRound size={16} /> : <Bot size={16} />}
      </div>
      <div className={`message-bubble ${isUser ? 'bubble-user' : branch ? 'bubble-branch' : 'bubble-ai'}`}>
        <div className="message-role">{isUser ? '你' : branch ? '衍生助手' : '主线助手'}</div>
        <div className="message-content">{message.content}</div>
      </div>
    </article>
  );
}


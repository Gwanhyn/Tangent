import { Bot, GitBranch, Pencil, Save, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useCopy } from '../i18n';
import MarkdownContent from './MarkdownContent';

export default function MessageBubble({ message, branch, onEdit }) {
  const copy = useCopy();
  const isUser = message.role === 'user';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const save = () => {
    const next = draft.trim();
    if (next && next !== message.content) {
      onEdit?.(message, next);
    }
    setEditing(false);
  };

  return (
    <article
      className={`message-row ${isUser ? 'message-row-user' : ''}`}
      data-message-id={message.id}
    >
      <div className={`message-avatar ${isUser ? 'avatar-user' : branch ? 'avatar-branch' : 'avatar-ai'}`}>
        {isUser ? <UserRound size={16} /> : <Bot size={16} />}
      </div>
      <div className={`message-bubble ${isUser ? 'bubble-user' : branch ? 'bubble-branch' : 'bubble-ai'}`}>
        <div className="message-role-line">
          <div className="message-role">{isUser ? copy.chat.you : branch ? copy.chat.branchAssistant : copy.chat.mainAssistant}</div>
          {isUser && !message.id.startsWith('local_') && onEdit && (
            <button className="message-tool" type="button" onClick={() => setEditing(true)} title={copy.chat.edit}>
              <Pencil size={14} />
            </button>
          )}
        </div>
        {editing ? (
          <div className="edit-box">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} />
            <div className="edit-actions">
              <button type="button" onClick={save}><Save size={14} /> {copy.chat.saveResend}</button>
              <button type="button" onClick={() => setEditing(false)}><X size={14} /> {copy.chat.cancel}</button>
            </div>
          </div>
        ) : (
          <div className="message-content">
            <MarkdownContent content={message.content} />
          </div>
        )}
      </div>
    </article>
  );
}

export function BranchMarker({ marker, onOpen }) {
  const copy = useCopy();
  const label = marker.status === 'open'
    ? copy.chat.branchOpen
    : marker.status === 'merged'
      ? copy.chat.branchMerged
      : copy.chat.branchDiscarded;
  return (
    <button className="branch-marker" type="button" onClick={() => onOpen(marker.id)}>
      <GitBranch size={15} />
      <span>{label}</span>
      <small>{marker.message_count} {copy.chat.branchCount}{marker.memory_summary ? ` · ${marker.memory_summary}` : ''}</small>
    </button>
  );
}

import { Bot, ChevronUp, GitBranch, Pencil, Save, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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

export function BranchMarker({ marker, onOpen, onDelete, displayMode = 'compact' }) {
  const copy = useCopy();
  const [expanded, setExpanded] = useState(displayMode === 'full');
  const hasMemory = Boolean(marker.memory_summary);
  const compactCount = copy.chat.totalPrefix
    ? `${copy.chat.totalPrefix}${marker.message_count}${copy.chat.branchCount}`
    : `${marker.message_count} ${copy.chat.branchCount}`;
  const compactText = hasMemory
    ? marker.memory_summary
    : compactCount;
  const detailText = hasMemory
    ? marker.memory_summary
    : `${marker.message_count} ${copy.chat.branchCount}`;
  const isExpanded = displayMode === 'full' || expanded;

  useEffect(() => {
    setExpanded(displayMode === 'full');
  }, [displayMode]);

  if (!isExpanded) {
    return (
      <div className="branch-marker branch-marker-compact">
        <button className="branch-marker-open" type="button" onClick={() => setExpanded(true)}>
          <GitBranch size={14} />
          <span>{compactText}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`branch-marker branch-marker-expanded ${hasMemory ? 'branch-marker-memory' : ''}`}>
      <button className="branch-marker-open" type="button" onClick={() => onOpen(marker.id)}>
        <GitBranch size={15} />
        <span>{detailText}</span>
      </button>
      {displayMode === 'compact' && (
        <button
          className="branch-marker-delete branch-marker-collapse"
          type="button"
          onClick={() => setExpanded(false)}
          title={copy.chat.collapseBranch}
        >
          <ChevronUp size={14} />
        </button>
      )}
      {onDelete && (
        <button
          className="branch-marker-delete"
          type="button"
          onClick={() => onDelete(marker.id)}
          title={copy.chat.deleteBranch}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export function BranchMarkerGroup({ markers, onOpen, onDelete, displayMode = 'compact' }) {
  const copy = useCopy();
  const [expanded, setExpanded] = useState(displayMode === 'full');
  const totalCount = markers.reduce((sum, marker) => sum + Number(marker.message_count || 0), 0);
  const compactText = copy.chat.totalPrefix
    ? `${copy.chat.totalPrefix}${totalCount}${copy.chat.branchCount}`
    : `${totalCount} ${copy.chat.branchCount}`;

  useEffect(() => {
    setExpanded(displayMode === 'full');
  }, [displayMode]);

  if (displayMode === 'compact' && !expanded) {
    return (
      <div className="branch-marker branch-marker-compact branch-marker-group">
        <button className="branch-marker-open" type="button" onClick={() => setExpanded(true)}>
          <GitBranch size={13} />
          <span>{compactText}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="branch-marker-group-expanded">
      <div className="branch-marker-group-head">
        <span>{compactText}</span>
        {displayMode === 'compact' && (
          <button type="button" onClick={() => setExpanded(false)}>
            <ChevronUp size={13} />
            {copy.chat.collapseBranch}
          </button>
        )}
      </div>
      <div className="branch-marker-group-list">
        {markers.map((marker) => (
          <BranchMarker
            key={marker.id}
            marker={marker}
            onOpen={onOpen}
            onDelete={onDelete}
            displayMode="full"
          />
        ))}
      </div>
    </div>
  );
}

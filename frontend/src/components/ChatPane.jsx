import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, GitBranchPlus, Loader2, MemoryStick, Octagon, Pencil, Sparkles, X } from 'lucide-react';
import Composer from './Composer';
import ContextTimeline from './ContextTimeline';
import MessageBubble, { BranchMarker, BranchMarkerGroup } from './MessageBubble';
import { useCopy } from '../i18n';

export default function ChatPane({
  title,
  subtitle,
  messages,
  branchMarkers = [],
  onSend,
  onEdit,
  onStop,
  loading,
  disabled,
  placeholder,
  branch = false,
  hiddenMemoryCount = 0,
  onOpenBranch,
  showBranchButton = Boolean(onOpenBranch),
  onOpenBranchFromMarker,
  onDeleteBranch,
  branchMarkerMode = 'compact',
  sendShortcut = 'enter',
  onRenameTitle,
}) {
  const copy = useCopy();
  const shellRef = useRef(null);
  const listRef = useRef(null);
  const isPrimary = !branch;
  const showPaneHeader = isPrimary || Boolean(title) || Boolean(subtitle);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectionTrigger, setSelectionTrigger] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  const markersByParent = useMemo(() => {
    const map = new Map();
    for (const marker of branchMarkers) {
      const key = marker.parent_id || '__root__';
      map.set(key, [...(map.get(key) || []), marker]);
    }
    return map;
  }, [branchMarkers]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || (!autoScroll && !loading)) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, autoScroll, loading]);

  useEffect(() => {
    if (!editingTitle) {
      setTitleDraft(title);
    }
  }, [editingTitle, title]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distance < 96);
  };

  const handleSelection = (event) => {
    if (branch || !onOpenBranch) return;
    window.setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      const row = event.target.closest?.('[data-message-id]');
      if (!text || text.length < 2 || !row) {
        setSelectionTrigger(null);
        return;
      }
      const paneRect = shellRef.current?.getBoundingClientRect();
      const bounds = paneRect || {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };
      const minX = bounds.left + 10;
      const minY = bounds.top + 10;
      const maxX = Math.max(minX, bounds.right - 76);
      const maxY = Math.max(minY, bounds.bottom - 40);
      setSelectionTrigger({
        text: text.slice(0, 1200),
        parentId: row.dataset.messageId,
        x: Math.min(Math.max(event.clientX, minX), maxX),
        y: Math.min(Math.max(event.clientY + 10, minY), maxY),
      });
    }, 0);
  };

  const openFromSelection = () => {
    if (!selectionTrigger) return;
    onOpenBranch?.({
      selectedText: selectionTrigger.text,
      parentId: selectionTrigger.parentId,
    });
    setSelectionTrigger(null);
    window.getSelection()?.removeAllRanges();
  };

  const jumpToMessage = (messageId) => {
    const row = listRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveTitle = () => {
    const nextTitle = titleDraft.trim();
    if (nextTitle && nextTitle !== title) {
      onRenameTitle?.(nextTitle);
    }
    setEditingTitle(false);
  };

  const renderBranchMarkers = (markers = []) => {
    if (markers.length === 0) return null;
    const markerSignature = markers
      .map((marker) => [
        marker.id,
        marker.status,
        marker.message_count,
        marker.memory_summary || '',
      ].join(':'))
      .join('|');
    if (branchMarkerMode === 'compact') {
      return (
        <div className="branch-tracker-slot" key={`branch-group-slot-${markerSignature}`}>
          <BranchMarkerGroup
            key={`branch-group-${markerSignature}`}
            markers={markers}
            onOpen={onOpenBranchFromMarker}
            onDelete={onDeleteBranch}
            displayMode={branchMarkerMode}
          />
        </div>
      );
    }
    return (
      <div className="branch-tracker-slot" key={`branch-list-slot-${markerSignature}`}>
        {markers.map((marker) => (
          <BranchMarker
            key={`${marker.id}:${marker.status}:${marker.message_count}:${marker.memory_summary || ''}`}
            marker={marker}
            onOpen={onOpenBranchFromMarker}
            onDelete={onDeleteBranch}
            displayMode={branchMarkerMode}
          />
        ))}
      </div>
    );
  };

  return (
    <section ref={shellRef} className={`pane-shell ${branch ? 'pane-branch' : 'pane-main'} ${showPaneHeader ? '' : 'pane-no-header'}`}>
      {showPaneHeader && (
        <header className={`pane-header ${isPrimary ? 'pane-header-primary' : ''}`}>
          {isPrimary && (
            <div className="primary-brand-block">
              <strong>Tangent</strong>
              <span>{copy.chat.primaryEyebrow}</span>
            </div>
          )}
          <div className="pane-heading">
            {!isPrimary && <p className="eyebrow">{copy.chat.branchEyebrow}</p>}
            {title && (
              <div className="pane-title-row">
                {editingTitle ? (
                  <>
                    <input
                      className="title-edit-input"
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveTitle();
                        }
                        if (event.key === 'Escape') {
                          setEditingTitle(false);
                          setTitleDraft(title);
                        }
                      }}
                      autoFocus
                      aria-label={copy.chat.titleInputLabel}
                    />
                    <button className="title-edit-action" type="button" onClick={saveTitle} title={copy.chat.saveTitle}>
                      <Check size={14} />
                    </button>
                    <button
                      className="title-edit-action"
                      type="button"
                      onClick={() => {
                        setEditingTitle(false);
                        setTitleDraft(title);
                      }}
                      title={copy.chat.cancel}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <h2>{title}</h2>
                    {!branch && onRenameTitle && (
                      <button
                        className="title-edit-button"
                        type="button"
                        onClick={() => setEditingTitle(true)}
                        title={copy.chat.renameTitle}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {subtitle && <p className="pane-subtitle">{subtitle}</p>}
          </div>
          {isPrimary && (
            <div className="pane-actions">
              {hiddenMemoryCount > 0 && (
                <span className="memory-chip" title={copy.chat.memoryTooltip}>
                  <MemoryStick size={15} />
                  <span>{hiddenMemoryCount} {copy.chat.hiddenMemory}</span>
                </span>
              )}
              {showBranchButton && onOpenBranch && (
                <button className="derive-button" onClick={() => onOpenBranch()} type="button">
                  <GitBranchPlus size={17} />
                  {copy.chat.branchOut}
                </button>
              )}
            </div>
          )}
        </header>
      )}

      <ContextTimeline messages={messages} label={copy.chat.timeline} listRef={listRef} onJump={jumpToMessage} />

      <div
        ref={listRef}
        className="message-list"
        onScroll={handleScroll}
        onMouseUp={handleSelection}
      >
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-orb">
              <Sparkles size={28} />
            </div>
            <h3>{branch ? copy.chat.emptyBranchTitle : copy.chat.emptyMainTitle}</h3>
            <p>
              {branch
                ? copy.chat.emptyBranchBody
                : copy.chat.emptyMainBody}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <Fragment key={message.id}>
              <MessageBubble message={message} branch={branch} onEdit={onEdit} />
              {!branch && renderBranchMarkers(markersByParent.get(message.id))}
            </Fragment>
          ))
        )}
        {!branch && renderBranchMarkers(markersByParent.get('__root__'))}
        {loading && (
          <div className="typing-card">
            <Loader2 className="animate-spin" size={16} />
            {copy.chat.typing}
          </div>
        )}
      </div>

      {selectionTrigger && (
        <button
          className="selection-popover"
          style={{ left: selectionTrigger.x, top: selectionTrigger.y }}
          type="button"
          onClick={openFromSelection}
        >
          <GitBranchPlus size={15} />
          <span>{copy.chat.selectionBranch}</span>
        </button>
      )}

      <div className="composer-zone">
        {loading && onStop && (
          <button className="stop-button" type="button" onClick={onStop}>
            <Octagon size={16} />
            {copy.chat.stop}
          </button>
        )}
        <Composer
          onSend={onSend}
          loading={loading}
          disabled={disabled}
          placeholder={placeholder}
          sendLabel={copy.chat.send}
          generatingLabel={copy.chat.generating}
          sendShortcut={sendShortcut}
        />
      </div>
    </section>
  );
}

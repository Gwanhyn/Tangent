import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchPlus, Loader2, MemoryStick, Octagon, Sparkles } from 'lucide-react';
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
}) {
  const copy = useCopy();
  const listRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectionTrigger, setSelectionTrigger] = useState(null);

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
      setSelectionTrigger({
        text: text.slice(0, 1200),
        parentId: row.dataset.messageId,
        x: event.clientX,
        y: event.clientY,
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

  const renderBranchMarkers = (markers = []) => {
    if (markers.length === 0) return null;
    if (branchMarkerMode === 'compact') {
      return (
        <BranchMarkerGroup
          markers={markers}
          onOpen={onOpenBranchFromMarker}
          onDelete={onDeleteBranch}
          displayMode={branchMarkerMode}
        />
      );
    }
    return markers.map((marker) => (
      <BranchMarker
        key={marker.id}
        marker={marker}
        onOpen={onOpenBranchFromMarker}
        onDelete={onDeleteBranch}
        displayMode={branchMarkerMode}
      />
    ));
  };

  return (
    <section className={`pane-shell ${branch ? 'pane-branch' : 'pane-main'}`}>
      <header className="pane-header">
        <div>
          <p className="eyebrow">{branch ? copy.chat.branchEyebrow : copy.chat.primaryEyebrow}</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {!branch && (
          <div className="pane-actions">
            {hiddenMemoryCount > 0 && (
              <span className="memory-chip" title={copy.chat.memoryTooltip}>
                <MemoryStick size={15} />
                {hiddenMemoryCount} {copy.chat.hiddenMemory}
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
          {copy.chat.selectionBranch}
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

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchPlus, Loader2, MemoryStick, Octagon, Sparkles } from 'lucide-react';
import Composer from './Composer';
import MessageBubble, { BranchMarker } from './MessageBubble';

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
  onOpenBranchFromMarker,
}) {
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
    if (!el || !autoScroll) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, autoScroll]);

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

  return (
    <section className={`pane-shell ${branch ? 'pane-branch' : 'pane-main'}`}>
      <header className="pane-header">
        <div>
          <p className="eyebrow">{branch ? 'Parallel Pane' : 'Main Thread'}</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {!branch && (
          <div className="pane-actions">
            {hiddenMemoryCount > 0 && (
              <span className="memory-chip" title="这些隐藏消息会参与下一次主线模型调用">
                <MemoryStick size={15} />
                {hiddenMemoryCount} 条隐藏记忆
              </span>
            )}
            <button className="derive-button" onClick={() => onOpenBranch?.()} type="button">
              <GitBranchPlus size={17} />
              开启衍生
            </button>
          </div>
        )}
      </header>

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
            <h3>{branch ? '从这里追问一个细节' : '开启一段可分叉的对话'}</h3>
            <p>
              {branch
                ? '右侧衍生窗口会继承左侧快照。关闭时，你可以选择同步成隐藏记忆，或保持纯净模式保留快照但不影响主线。'
                : '先配置模型 Provider，然后发送第一条消息。之后可以随时打开衍生窗口做平行探索。'}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <Fragment key={message.id}>
              <MessageBubble message={message} branch={branch} onEdit={onEdit} />
              {!branch && markersByParent.get(message.id)?.map((marker) => (
                <BranchMarker key={marker.id} marker={marker} onOpen={onOpenBranchFromMarker} />
              ))}
            </Fragment>
          ))
        )}
        {!branch && markersByParent.get('__root__')?.map((marker) => (
          <BranchMarker key={marker.id} marker={marker} onOpen={onOpenBranchFromMarker} />
        ))}
        {loading && (
          <div className="typing-card">
            <Loader2 className="animate-spin" size={16} />
            模型正在编织回复...
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
          在此开启平行衍生
        </button>
      )}

      <div className="composer-zone">
        {loading && onStop && (
          <button className="stop-button" type="button" onClick={onStop}>
            <Octagon size={16} />
            停止生成
          </button>
        )}
        <Composer
          onSend={onSend}
          loading={loading}
          disabled={disabled}
          placeholder={placeholder}
        />
      </div>
    </section>
  );
}

import { GitBranchPlus, Loader2, MemoryStick, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Composer from './Composer';
import MessageBubble from './MessageBubble';

export default function ChatPane({
  title,
  subtitle,
  messages,
  onSend,
  loading,
  disabled,
  placeholder,
  branch = false,
  hiddenMemoryCount = 0,
  onOpenBranch,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

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
            <button className="derive-button" onClick={onOpenBranch} type="button">
              <GitBranchPlus size={17} />
              开启衍生
            </button>
          </div>
        )}
      </header>

      <div ref={listRef} className="message-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-orb">
              <Sparkles size={28} />
            </div>
            <h3>{branch ? '从这里追问一个细节' : '开启一段可分叉的对话'}</h3>
            <p>
              {branch
                ? '右侧衍生窗口会继承左侧快照。关闭时，你可以选择同步成隐藏记忆，或保持纯净模式直接销毁。'
                : '先配置模型 Provider，然后发送第一条消息。之后可以随时打开衍生窗口做平行探索。'}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} branch={branch} />
          ))
        )}
        {loading && (
          <div className="typing-card">
            <Loader2 className="animate-spin" size={16} />
            模型正在编织回复...
          </div>
        )}
      </div>

      <Composer
        onSend={onSend}
        loading={loading}
        disabled={disabled}
        placeholder={placeholder}
      />
    </section>
  );
}


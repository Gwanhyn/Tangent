import { CheckCircle2, ShieldOff, X } from 'lucide-react';
import ChatPane from './ChatPane';

export default function ParallelPane({
  messages,
  syncMemory,
  onSyncMemoryChange,
  onClose,
  onSend,
  loading,
}) {
  return (
    <section className="parallel-wrap">
      <div className="parallel-toolbar">
        <div>
          <p className="eyebrow">Derive Toggle On</p>
          <h3>衍生窗口</h3>
        </div>
        <button className="icon-button" onClick={onClose} type="button" title="关闭衍生窗口">
          <X size={18} />
        </button>
      </div>

      <label className={`sync-card ${syncMemory ? 'sync-on' : ''}`}>
        <input
          type="checkbox"
          checked={syncMemory}
          onChange={(event) => onSyncMemoryChange(event.target.checked)}
        />
        <div className="sync-icon">
          {syncMemory ? <CheckCircle2 size={18} /> : <ShieldOff size={18} />}
        </div>
        <div>
          <strong>{syncMemory ? '记忆同步' : '纯净模式'}</strong>
          <span>
            {syncMemory
              ? '关闭后，本分支会写入主线隐藏上下文。'
              : '关闭后，本分支会被销毁，不影响主线。'}
          </span>
        </div>
      </label>

      <ChatPane
        branch
        title="针对左侧快照追问"
        subtitle="分支内容暂时只存在于右侧，是否并回主记忆由上方开关决定。"
        messages={messages}
        onSend={onSend}
        loading={loading}
        placeholder="在衍生窗口追问：比如“把刚才那个概念换个例子解释”"
      />
    </section>
  );
}


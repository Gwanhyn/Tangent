import { CheckCircle2, ShieldOff, X } from 'lucide-react';
import ChatPane from './ChatPane';

export default function ParallelPane({
  messages,
  providers,
  providerId,
  onProviderChange,
  status,
  selectedText,
  syncMemory,
  onSyncMemoryChange,
  onClose,
  onSend,
  onEdit,
  onStop,
  loading,
}) {
  const readOnly = status && status !== 'open';

  return (
    <section className="parallel-wrap">
      <div className="parallel-toolbar">
        <div>
          <p className="eyebrow">Derive Toggle On</p>
          <h3>{readOnly ? '衍生快照' : '衍生窗口'}</h3>
        </div>
        <button className="icon-button" onClick={onClose} type="button" title="关闭衍生窗口">
          <X size={18} />
        </button>
      </div>

      <div className="parallel-controls">
        <label className="parallel-model">
          <span>衍生模型</span>
          <select
            value={providerId || ''}
            disabled={readOnly}
            onChange={(event) => onProviderChange(event.target.value)}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} · {provider.model_name}
              </option>
            ))}
          </select>
        </label>

        <label className={`sync-card ${syncMemory ? 'sync-on' : ''} ${readOnly ? 'sync-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={syncMemory}
            disabled={readOnly}
            onChange={(event) => onSyncMemoryChange(event.target.checked)}
          />
          <div className="sync-icon">
            {syncMemory ? <CheckCircle2 size={18} /> : <ShieldOff size={18} />}
          </div>
          <div>
            <strong>{syncMemory ? '记忆同步' : '纯净模式'}</strong>
            <span>
              {readOnly
                ? '这是历史分支快照，仅供追溯查看。'
                : syncMemory
                  ? '关闭后，本分支会提炼摘要并写入主线隐藏上下文。'
                  : '关闭后，本分支会保留为快照，但不影响主线。'}
            </span>
          </div>
        </label>

        {selectedText && (
          <div className="selected-context">
            <strong>划词上下文</strong>
            <span>{selectedText}</span>
          </div>
        )}
      </div>

      <div className="parallel-chat-slot">
        <ChatPane
          branch
          title="针对左侧快照追问"
          subtitle={readOnly ? '历史衍生线已关闭，可回看当时的追问细节。' : '分支内容暂时只存在于右侧，是否并回主记忆由上方开关决定。'}
          messages={messages}
          onSend={onSend}
          onEdit={readOnly ? undefined : onEdit}
          onStop={onStop}
          loading={loading}
          disabled={readOnly}
          placeholder="在衍生窗口追问：比如“把刚才那个概念换个例子解释”"
        />
      </div>
    </section>
  );
}

import { Brain, CheckCircle2, GitBranch, ShieldOff, X } from 'lucide-react';
import ChatPane from './ChatPane';
import { useCopy } from '../i18n';

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
  const copy = useCopy();
  const readOnly = status && status !== 'open';
  const memoryTitle = readOnly
    ? copy.parallel.readOnlyHint
    : syncMemory
      ? `${copy.parallel.memoryOn}: ${copy.parallel.memoryOnHint}`
      : `${copy.parallel.memoryOff}: ${copy.parallel.memoryOffHint}`;

  return (
    <section className="parallel-wrap">
      <div className="parallel-toolbar">
        <div>
          <p className="eyebrow">{copy.parallel.toolbarEyebrow}</p>
          <h3>{readOnly ? copy.parallel.snapshotTitle : copy.parallel.openTitle}</h3>
        </div>
        <div className="parallel-toolbar-actions">
          <label className="parallel-model">
            <span>{copy.parallel.model}</span>
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
          <button
            className={`branch-tool-button ${syncMemory ? 'active' : ''}`}
            disabled={readOnly}
            onClick={() => onSyncMemoryChange(!syncMemory)}
            title={memoryTitle}
            type="button"
          >
            {syncMemory ? <Brain size={17} /> : <ShieldOff size={17} />}
            <span className="sr-only">{syncMemory ? copy.parallel.memoryOn : copy.parallel.memoryOff}</span>
          </button>
          <button className="branch-tool-button active" disabled type="button" title={copy.parallel.toolbarEyebrow}>
            <GitBranch size={17} />
          </button>
          <button className="icon-button" onClick={onClose} type="button" title={copy.parallel.close}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="parallel-controls">
        <div className={`sync-card sync-compact ${syncMemory ? 'sync-on' : ''} ${readOnly ? 'sync-disabled' : ''}`}>
          <div className="sync-icon">
            {syncMemory ? <CheckCircle2 size={18} /> : <ShieldOff size={18} />}
          </div>
          <span>{memoryTitle}</span>
        </div>

        {selectedText && (
          <div className="selected-context">
            <strong>{copy.parallel.selectedContext}</strong>
            <span>{selectedText}</span>
          </div>
        )}
      </div>

      <div className="parallel-chat-slot">
        <ChatPane
          branch
          title={copy.parallel.chatTitle}
          subtitle={readOnly ? copy.parallel.chatSubtitleClosed : copy.parallel.chatSubtitleOpen}
          messages={messages}
          onSend={onSend}
          onEdit={readOnly ? undefined : onEdit}
          onStop={onStop}
          loading={loading}
          disabled={readOnly}
          placeholder={copy.chat.composer}
        />
      </div>
    </section>
  );
}

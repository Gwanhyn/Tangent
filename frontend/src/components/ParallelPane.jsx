import { Brain, Plus, ShieldOff, Trash2, X } from 'lucide-react';
import ChatPane from './ChatPane';
import PrettySelect from './PrettySelect';
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
  onNewBranch,
  onDelete,
  onClose,
  onSend,
  onEdit,
  onStop,
  loading,
  sendShortcut,
  placeholder,
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
          <PrettySelect
            className="parallel-model"
            disabled={readOnly || providers.length === 0}
            value={providerId || providers[0]?.id || ''}
            onChange={onProviderChange}
            options={providers.map((provider) => ({
              value: provider.id,
              label: provider.name,
              description: provider.model_name,
            }))}
          />
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
          <button
            className="branch-tool-button"
            disabled={loading}
            onClick={onNewBranch}
            type="button"
            title={copy.parallel.newBranch}
          >
            <Plus size={17} />
          </button>
          <button
            className="branch-tool-button danger"
            disabled={loading}
            onClick={onDelete}
            type="button"
            title={copy.parallel.deleteBranch}
          >
            <Trash2 size={17} />
          </button>
          <button className="icon-button" onClick={onClose} type="button" title={copy.parallel.close}>
            <X size={18} />
          </button>
        </div>
      </div>

      {selectedText && (
        <div className="parallel-controls">
          <div className="selected-context">
            <span>{selectedText}</span>
          </div>
        </div>
      )}

      <div className="parallel-chat-slot">
        <ChatPane
          branch
          title=""
          subtitle=""
          messages={messages}
          onSend={onSend}
          onEdit={readOnly ? undefined : onEdit}
          onStop={onStop}
          loading={loading}
          disabled={readOnly}
          placeholder={placeholder}
          sendShortcut={sendShortcut}
        />
      </div>
    </section>
  );
}

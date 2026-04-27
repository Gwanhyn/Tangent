import { MessageSquarePlus, Settings, Trash2, Waves } from 'lucide-react';
import { useCopy } from '../i18n';
import { useChatStore } from '../store/chatStore';

export default function Sidebar() {
  const copy = useCopy();
  const {
    conversations,
    activeConversation,
    createConversation,
    selectConversation,
    deleteConversation,
    setSettingsOpen,
    setEnginesOpen,
    providers,
  } = useChatStore();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Waves size={21} />
        </div>
        <div>
          <strong>Tangent</strong>
          <span>{copy.sidebar.version}</span>
        </div>
      </div>

      <button className="new-chat" onClick={createConversation} type="button">
        <MessageSquarePlus size={17} />
        {copy.sidebar.newChat}
      </button>

      <div className="conversation-list">
        {conversations.map((conversation) => {
          const summary = conversation.summary || conversation.title || copy.sidebar.untitled;
          return (
            <div
              className={`conversation-item ${conversation.id === activeConversation?.id ? 'active' : ''}`}
              data-tooltip={summary}
              key={conversation.id}
              onClick={() => selectConversation(conversation.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectConversation(conversation.id);
                }
              }}
              role="button"
              tabIndex={0}
              title={`${copy.sidebar.conversationTooltip}: ${summary}`}
            >
              <span>{summary}</span>
              <button
                className="conversation-delete"
                type="button"
                title={copy.sidebar.deleteConversation}
                onClick={(event) => {
                  event.stopPropagation();
                  deleteConversation(conversation.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button className="settings-icon-button" onClick={() => setSettingsOpen(true)} type="button" title={copy.sidebar.settings}>
          <Settings size={18} />
        </button>
        <button className="settings-button" onClick={() => setEnginesOpen(true)} type="button">
          <span className="settings-label">{copy.sidebar.engines}</span>
          <span className="settings-count">{providers.length}</span>
        </button>
      </div>
    </aside>
  );
}

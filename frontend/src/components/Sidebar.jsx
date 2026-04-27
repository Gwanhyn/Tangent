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
            <button
              className={`conversation-item ${conversation.id === activeConversation?.id ? 'active' : ''}`}
              data-tooltip={summary}
              key={conversation.id}
              onClick={() => selectConversation(conversation.id)}
              title={`${copy.sidebar.conversationTooltip}: ${summary}`}
              type="button"
            >
              <span>{summary}</span>
              <Trash2
                size={14}
                onClick={(event) => {
                  event.stopPropagation();
                  deleteConversation(conversation.id);
                }}
              />
            </button>
          );
        })}
      </div>

      <button className="settings-button" onClick={() => setSettingsOpen(true)} type="button">
        <Settings size={17} />
        {copy.sidebar.settings}
        <span>{providers.length}</span>
      </button>
    </aside>
  );
}

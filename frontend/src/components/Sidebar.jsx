import { Cpu, MessageSquarePlus, Settings, Trash2, Waves } from 'lucide-react';
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
    sidebarCollapsed,
    toggleSidebar,
    providers,
  } = useChatStore();

  if (sidebarCollapsed) {
    return (
      <aside className="sidebar is-collapsed" aria-label={copy.sidebar.collapsedLabel}>
        <div className="sidebar-rail">
          <button className="rail-button rail-brand" onClick={toggleSidebar} type="button" title={copy.sidebar.expandSidebar}>
            <Waves size={21} />
          </button>
          <button className="rail-button" onClick={createConversation} type="button" title={copy.sidebar.newChat}>
            <MessageSquarePlus size={18} />
          </button>
          <div className="rail-spacer" />
          <button className="rail-button" onClick={() => setSettingsOpen(true)} type="button" title={copy.sidebar.settings}>
            <Settings size={18} />
          </button>
          <button className="rail-button rail-engine" onClick={() => setEnginesOpen(true)} type="button" title={copy.sidebar.engines}>
            <Cpu size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <button className="brand-mark brand-toggle" onClick={toggleSidebar} type="button" title={copy.sidebar.collapseSidebar}>
          <Waves size={21} />
        </button>
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
          <Cpu size={17} />
          <span className="settings-label">{copy.sidebar.engines}</span>
          <span className="settings-count">{providers.length}</span>
        </button>
      </div>
    </aside>
  );
}

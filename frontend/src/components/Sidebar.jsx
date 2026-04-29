import { useMemo, useState } from 'react';
import { Cpu, MessageSquarePlus, Search, Settings, Trash2, Waves, X } from 'lucide-react';
import { useCopy } from '../i18n';
import { useChatStore } from '../store/chatStore';

export default function Sidebar() {
  const copy = useCopy();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const normalizedSearch = searchOpen ? searchQuery.trim().toLowerCase() : '';
  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) return conversations;
    return conversations.filter((conversation) => {
      const haystack = [
        conversation.summary,
        conversation.title,
        conversation.searchable_memory,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [conversations, normalizedSearch]);

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
      <div className="sidebar-topbar">
        <button className="brand-mark brand-toggle" onClick={toggleSidebar} type="button" title={copy.sidebar.collapseSidebar}>
          <Waves size={21} />
        </button>
        <button
          className={`sidebar-search-toggle ${searchOpen ? 'active' : ''}`}
          onClick={() => setSearchOpen((open) => !open)}
          type="button"
          title={copy.sidebar.searchConversations}
        >
          <Search size={18} />
        </button>
      </div>

      {searchOpen && (
        <label className="sidebar-search" aria-label={copy.sidebar.searchConversations}>
          <Search size={15} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={copy.sidebar.searchPlaceholder}
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              title={copy.sidebar.clearSearch}
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </label>
      )}

      <button className="new-chat" onClick={createConversation} type="button">
        <MessageSquarePlus size={17} />
        {copy.sidebar.newChat}
      </button>

      <div className="conversation-list">
        {filteredConversations.map((conversation) => {
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
        {filteredConversations.length === 0 && (
          <div className="conversation-empty">{copy.sidebar.noSearchResults}</div>
        )}
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

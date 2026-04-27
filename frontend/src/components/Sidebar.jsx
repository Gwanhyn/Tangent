import { MessageSquarePlus, Settings, Trash2, Waves } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export default function Sidebar() {
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
          <strong>AI Parallel Chat</strong>
          <span>平行衍生交互系统</span>
        </div>
      </div>

      <button className="new-chat" onClick={createConversation} type="button">
        <MessageSquarePlus size={17} />
        新建对话
      </button>

      <div className="conversation-list">
        {conversations.map((conversation) => (
          <button
            className={`conversation-item ${conversation.id === activeConversation?.id ? 'active' : ''}`}
            key={conversation.id}
            onClick={() => selectConversation(conversation.id)}
            type="button"
          >
            <span>{conversation.title}</span>
            <Trash2
              size={14}
              onClick={(event) => {
                event.stopPropagation();
                deleteConversation(conversation.id);
              }}
            />
          </button>
        ))}
      </div>

      <button className="settings-button" onClick={() => setSettingsOpen(true)} type="button">
        <Settings size={17} />
        模型设置
        <span>{providers.length}</span>
      </button>
    </aside>
  );
}


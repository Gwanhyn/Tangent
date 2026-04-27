import { AlertTriangle, GripVertical, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ChatPane from './components/ChatPane';
import ParallelPane from './components/ParallelPane';
import ProviderPanel from './components/ProviderPanel';
import Sidebar from './components/Sidebar';
import { useChatStore } from './store/chatStore';

export default function App() {
  const workspaceRef = useRef(null);
  const {
    bootstrapping,
    activeConversation,
    messages,
    hiddenMemoryCount,
    isParallelMode,
    branchMessages,
    syncMemory,
    paneWidth,
    settingsOpen,
    mainLoading,
    branchLoading,
    error,
    bootstrap,
    clearError,
    setPaneWidth,
    sendMainMessage,
    openBranch,
    sendBranchMessage,
    closeBranch,
    setSyncMemory,
  } = useChatStore();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const beginResize = (event) => {
    event.preventDefault();
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const move = (moveEvent) => {
      const nextWidth = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      setPaneWidth(nextWidth);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  if (bootstrapping) {
    return (
      <main className="boot-screen">
        <Loader2 className="animate-spin" size={28} />
        <span>正在启动平行对话工作台...</span>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Sidebar />

      <section
        ref={workspaceRef}
        className={`workspace ${isParallelMode ? 'is-parallel' : ''}`}
        style={{ '--main-pane': `${paneWidth}%` }}
      >
        <ChatPane
          title={activeConversation?.title || '新的平行对话'}
          subtitle="主线只展示线性对话；已同步的衍生内容会以隐藏记忆参与模型调用。"
          messages={messages}
          hiddenMemoryCount={hiddenMemoryCount}
          onSend={sendMainMessage}
          loading={mainLoading}
          placeholder="向主线提问，Ctrl/⌘ + Enter 发送"
          onOpenBranch={openBranch}
        />

        {isParallelMode && (
          <>
            <button className="resize-rail" onPointerDown={beginResize} type="button" aria-label="拖拽调整分栏宽度">
              <GripVertical size={20} />
            </button>
            <ParallelPane
              messages={branchMessages}
              syncMemory={syncMemory}
              onSyncMemoryChange={setSyncMemory}
              onClose={closeBranch}
              onSend={sendBranchMessage}
              loading={branchLoading}
            />
          </>
        )}
      </section>

      {settingsOpen && <ProviderPanel />}

      {error && (
        <button className="error-toast" onClick={clearError} type="button">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </button>
      )}
    </main>
  );
}


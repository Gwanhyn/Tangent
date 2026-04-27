import { AlertTriangle, GripVertical, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ChatPane from './components/ChatPane';
import ParallelPane from './components/ParallelPane';
import ProviderPanel from './components/ProviderPanel';
import Sidebar from './components/Sidebar';
import { useCopy } from './i18n';
import { useChatStore } from './store/chatStore';

export default function App() {
  const workspaceRef = useRef(null);
  const copy = useCopy();
  const {
    bootstrapping,
    activeConversation,
    messages,
    branchMarkers,
    hiddenMemoryCount,
    providers,
    branchProviderId,
    isParallelMode,
    activeBranch,
    branchMessages,
    syncMemory,
    paneWidth,
    settingsOpen,
    mainLoading,
    branchLoading,
    error,
    mainPaneColor,
    branchPaneColor,
    chatFontSize,
    bootstrap,
    syncWorkspace,
    clearError,
    setPaneWidth,
    setBranchProviderId,
    sendMainMessage,
    openBranch,
    openExistingBranch,
    stopMainGeneration,
    sendBranchMessage,
    stopBranchGeneration,
    closeBranch,
    setSyncMemory,
  } = useChatStore();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(clearError, 3000);
    return () => window.clearTimeout(timer);
  }, [error, clearError]);

  useEffect(() => {
    const syncWhenVisible = () => {
      if (!document.hidden) {
        syncWorkspace();
      }
    };
    window.addEventListener('focus', syncWhenVisible);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      window.removeEventListener('focus', syncWhenVisible);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [syncWorkspace]);

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
        <span>{copy.app.booting}</span>
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
        style={{
          '--main-pane': `${paneWidth}%`,
          '--main-pane-bg': mainPaneColor,
          '--branch-pane-bg': branchPaneColor,
          '--chat-font-size': `${chatFontSize}px`,
        }}
      >
        <ChatPane
          title={activeConversation?.summary || activeConversation?.title || copy.sidebar.untitled}
          subtitle={copy.chat.primarySubtitle}
          messages={messages}
          branchMarkers={branchMarkers}
          hiddenMemoryCount={hiddenMemoryCount}
          onSend={sendMainMessage}
          onEdit={(message, content) => sendMainMessage(content, { replaceFromMessageId: message.id })}
          onStop={stopMainGeneration}
          loading={mainLoading}
          placeholder={copy.chat.composer}
          onOpenBranch={openBranch}
          onOpenBranchFromMarker={openExistingBranch}
        />

        {isParallelMode && (
          <>
            <button className="resize-rail" onPointerDown={beginResize} type="button" aria-label="拖拽调整分栏宽度">
              <GripVertical size={20} />
            </button>
            <ParallelPane
              messages={branchMessages}
              providers={providers}
              providerId={branchProviderId}
              onProviderChange={setBranchProviderId}
              status={activeBranch?.status}
              selectedText={activeBranch?.selected_text}
              syncMemory={syncMemory}
              onSyncMemoryChange={setSyncMemory}
              onClose={closeBranch}
              onSend={sendBranchMessage}
              onEdit={(message, content) => sendBranchMessage(content, { replaceFromMessageId: message.id })}
              onStop={stopBranchGeneration}
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

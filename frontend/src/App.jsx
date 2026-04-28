import { AlertTriangle, GripVertical, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ChatPane from './components/ChatPane';
import ParallelPane from './components/ParallelPane';
import PreferencesPanel from './components/PreferencesPanel';
import ProviderPanel from './components/ProviderPanel';
import Sidebar from './components/Sidebar';
import { useCopy } from './i18n';
import { useChatStore } from './store/chatStore';

function clampPaneWidth(percent, containerWidth = 0) {
  if (!containerWidth || containerWidth < 720) {
    return 50;
  }
  const minPanePercent = Math.min(48, Math.max(34, (360 / containerWidth) * 100));
  return Math.min(100 - minPanePercent, Math.max(minPanePercent, percent));
}

export default function App() {
  const workspaceRef = useRef(null);
  const bypassBootScreenRef = useRef(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [bootFailed, setBootFailed] = useState(false);
  const copy = useCopy();
  const {
    bootstrapping,
    hydratedFromCache,
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
    enginesOpen,
    mainLoading,
    branchLoading,
    error,
    mainPaneColor,
    branchPaneColor,
    chatFontSize,
    sendShortcut,
    branchMarkerMode,
    sidebarCollapsed,
    bootstrap,
    syncWorkspace,
    clearError,
    setPaneWidth,
    setBranchProviderId,
    sendMainMessage,
    openBranch,
    openExistingBranch,
    deleteBranch,
    stopMainGeneration,
    sendBranchMessage,
    stopBranchGeneration,
    createNextBranch,
    closeBranch,
    setSyncMemory,
    renameConversation,
  } = useChatStore();

  if (hydratedFromCache) {
    bypassBootScreenRef.current = true;
  }

  useEffect(() => {
    let cancelled = false;
    setBootFailed(false);

    const runBootstrap = async () => {
      const completed = await bootstrap();
      if (!cancelled && !completed) {
        setBootFailed(true);
      }
    };

    runBootstrap();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, bootAttempt]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return undefined;
    const updateWidth = () => {
      setWorkspaceWidth(workspace.getBoundingClientRect().width);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(workspace);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [bootstrapping]);

  useEffect(() => {
    if (!error) return undefined;
    if (bootstrapping) return undefined;
    const timer = window.setTimeout(clearError, 3000);
    return () => window.clearTimeout(timer);
  }, [error, bootstrapping, clearError]);

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
      setPaneWidth(clampPaneWidth(nextWidth, bounds.width));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const showBootScreen = !bypassBootScreenRef.current && (bootstrapping || bootFailed);

  if (showBootScreen) {
    return (
      <main className="boot-screen">
        <Loader2 className="animate-spin" size={28} />
        <span>{copy.app.booting}</span>
        {bootFailed && error && (
          <>
            <small>{error}</small>
            <button
              type="button"
              onClick={() => {
                setBootAttempt((attempt) => attempt + 1);
              }}
            >
              {copy.app.retry}
            </button>
          </>
        )}
      </main>
    );
  }

  const composerPlaceholder = sendShortcut === 'ctrlEnter'
    ? copy.chat.composerCtrl
    : copy.chat.composerEnter;
  const safePaneWidth = isParallelMode
    ? clampPaneWidth(paneWidth, workspaceWidth)
    : paneWidth;

  return (
    <main className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Sidebar />

      <section
        ref={workspaceRef}
        className={`workspace ${isParallelMode ? 'is-parallel' : ''}`}
        style={{
          '--main-pane': `${safePaneWidth}%`,
          '--main-pane-bg': mainPaneColor,
          '--branch-pane-bg': branchPaneColor,
          '--chat-font-size': `${chatFontSize}px`,
        }}
      >
        <ChatPane
          title={activeConversation?.summary || activeConversation?.title || copy.sidebar.untitled}
          subtitle=""
          messages={messages}
          branchMarkers={branchMarkers}
          hiddenMemoryCount={hiddenMemoryCount}
          onSend={sendMainMessage}
          onEdit={(message, content) => sendMainMessage(content, { replaceFromMessageId: message.id })}
          onStop={stopMainGeneration}
          loading={mainLoading}
          placeholder={composerPlaceholder}
          onOpenBranch={openBranch}
          showBranchButton={!isParallelMode}
          onOpenBranchFromMarker={openExistingBranch}
          onDeleteBranch={deleteBranch}
          branchMarkerMode={branchMarkerMode}
          sendShortcut={sendShortcut}
          onRenameTitle={renameConversation}
        />

        {isParallelMode && (
          <>
            <button className="resize-rail" onPointerDown={beginResize} type="button" aria-label={copy.app.resizePane}>
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
              onNewBranch={createNextBranch}
              onDelete={() => deleteBranch(activeBranch?.id)}
              onClose={closeBranch}
              onSend={sendBranchMessage}
              onEdit={(message, content) => sendBranchMessage(content, { replaceFromMessageId: message.id })}
              onStop={stopBranchGeneration}
              loading={branchLoading}
              sendShortcut={sendShortcut}
              placeholder={composerPlaceholder}
            />
          </>
        )}
      </section>

      {settingsOpen && <PreferencesPanel />}
      {enginesOpen && <ProviderPanel />}

      {error && (
        <button className="error-toast" onClick={clearError} type="button">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </button>
      )}
    </main>
  );
}

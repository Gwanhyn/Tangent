import { AlertTriangle, GripVertical, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ChatPane from './components/ChatPane';
import ParallelPane from './components/ParallelPane';
import PreferencesPanel from './components/PreferencesPanel';
import ProviderPanel from './components/ProviderPanel';
import Sidebar from './components/Sidebar';
import { useCopy } from './i18n';
import { useChatStore } from './store/chatStore';

const LoadingPhase = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  FETCHING: 'FETCHING',
  FINALIZING: 'FINALIZING',
});

const PHASE_TARGETS = {
  [LoadingPhase.INITIALIZING]: 30,
  [LoadingPhase.FETCHING]: 90,
  [LoadingPhase.FINALIZING]: 100,
};

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
  const [loadingPhase, setLoadingPhase] = useState(LoadingPhase.INITIALIZING);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [targetProgress, setTargetProgress] = useState(PHASE_TARGETS[LoadingPhase.INITIALIZING]);
  const [isTimeout, setIsTimeout] = useState(false);
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
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setIsTimeout(true);
      }
    }, 30000);

    setIsTimeout(false);
    setLoadingPhase(LoadingPhase.INITIALIZING);
    setDisplayProgress(0);
    setTargetProgress(PHASE_TARGETS[LoadingPhase.INITIALIZING]);

    const runBootstrap = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      if (cancelled) return;
      setLoadingPhase(LoadingPhase.FETCHING);
      setTargetProgress(PHASE_TARGETS[LoadingPhase.FETCHING]);
      const completed = await bootstrap();
      if (cancelled) return;
      if (completed) {
        window.clearTimeout(timeout);
        setLoadingPhase(LoadingPhase.FINALIZING);
        setTargetProgress(PHASE_TARGETS[LoadingPhase.FINALIZING]);
      }
    };

    runBootstrap();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
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
    const timer = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= targetProgress) {
          return targetProgress;
        }
        const next = Math.min(targetProgress, current + 0.1);
        return Math.round(next * 1000) / 1000;
      });
    }, loadingPhase === LoadingPhase.FINALIZING ? 4 : 80);
    return () => window.clearInterval(timer);
  }, [loadingPhase, targetProgress]);

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

  const currentProgress = Math.min(100, displayProgress);
  const bootErrorMessage = error || (isTimeout ? copy.app.bootTimeout : '');
  const canShowBootError = Boolean(bootErrorMessage) && (currentProgress >= 100 || isTimeout);
  const showBootScreen = !bypassBootScreenRef.current
    && (bootstrapping || currentProgress < 100 || canShowBootError);
  const phaseLabel = copy.app.loadingPhases?.[loadingPhase] || copy.app.bootHint;

  if (showBootScreen) {
    return (
      <main className="boot-screen">
        <div className="boot-card">
          <Loader2 className="animate-spin" size={28} />
          <span>{copy.app.booting}</span>
          <div className="boot-progress" aria-label={copy.app.loadingProgress}>
            <div style={{ width: `${currentProgress}%` }} />
          </div>
          <strong>{currentProgress.toFixed(1)}%</strong>
          <small className="boot-muted">{phaseLabel}</small>
        </div>
        {canShowBootError && (
          <>
            <small>{bootErrorMessage}</small>
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
    <main className="app-shell">
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
          subtitle={copy.chat.primarySubtitle}
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

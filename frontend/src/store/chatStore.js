import { create } from 'zustand';
import { api } from '../api/client';

let mainAbortController = null;
let branchAbortController = null;
let bootstrapPromise = null;

const defaultPreferences = {
  locale: 'zh',
  mainPaneColor: '#fff8ec',
  branchPaneColor: '#142421',
  chatFontSize: 15,
};

function readPreference(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(`tangent.${key}`) || fallback;
}

function writePreference(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`tangent.${key}`, String(value));
}

function readNumberPreference(key, fallback) {
  const value = Number(readPreference(key, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function userFacingError(error) {
  const message = error?.message || String(error || 'Unknown error');
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return '无法连接 Tangent 服务，请确认后端已启动。';
  }
  return message;
}

const initialState = {
  bootstrapping: true,
  providers: [],
  conversations: [],
  activeConversation: null,
  messages: [],
  branchMarkers: [],
  hiddenMemoryCount: 0,
  selectedProviderId: null,
  branchProviderId: null,
  isParallelMode: false,
  activeBranch: null,
  branchMessages: [],
  syncMemory: false,
  paneWidth: 56,
  settingsOpen: false,
  mainLoading: false,
  branchLoading: false,
  error: '',
  locale: readPreference('locale', defaultPreferences.locale),
  mainPaneColor: readPreference('mainPaneColor', defaultPreferences.mainPaneColor),
  branchPaneColor: readPreference('branchPaneColor', defaultPreferences.branchPaneColor),
  chatFontSize: readNumberPreference('chatFontSize', defaultPreferences.chatFontSize),
};

function chooseProvider(providers, currentId) {
  if (providers.some((provider) => provider.id === currentId)) {
    return currentId;
  }
  return providers.find((provider) => provider.is_default)?.id || providers[0]?.id || null;
}

function truncateFromMessage(messages, messageId) {
  const index = messages.findIndex((message) => message.id === messageId);
  return index >= 0 ? messages.slice(0, index) : messages;
}

function optimisticMessage(role, content, scope = 'main') {
  return {
    id: `local_${scope}_${role}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    conversation_id: '',
    branch_id: scope === 'branch' ? 'local' : null,
    parent_id: null,
    role,
    content,
    is_hidden: false,
    created_at: new Date().toISOString(),
  };
}

function defaultConversationTitle(locale) {
  return locale === 'en' ? 'New Tangent Chat' : '新的平行对话';
}

async function hydrateConversation(conversationId) {
  const detail = await api.getConversation(conversationId);
  let branch = null;
  if (detail.open_branch_id) {
    branch = await api.getBranch(detail.open_branch_id);
  }
  return { detail, branch };
}

function applyConversationDetail(detail) {
  return {
    activeConversation: detail.conversation,
    messages: detail.messages,
    branchMarkers: detail.branches || [],
    hiddenMemoryCount: detail.hidden_memory_count,
  };
}

function applyConversationDetailSafely(detail, state) {
  return {
    ...applyConversationDetail(detail),
    messages: state.mainLoading ? state.messages : detail.messages,
  };
}

function appendDelta(messages, assistantId, delta) {
  return messages.map((message) => (
    message.id === assistantId
      ? { ...message, content: `${message.content || ''}${delta}` }
      : message
  ));
}

export const useChatStore = create((set, get) => ({
  ...initialState,

  setError: (error) => set({ error: userFacingError(error) }),
  clearError: () => set({ error: '' }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPaneWidth: (paneWidth) => set({ paneWidth: Math.min(66, Math.max(42, paneWidth)) }),
  setSyncMemory: (syncMemory) => set({ syncMemory }),
  setBranchProviderId: (branchProviderId) => set({ branchProviderId }),
  setLocale: (locale) => {
    writePreference('locale', locale);
    set({ locale });
  },
  setMainPaneColor: (mainPaneColor) => {
    writePreference('mainPaneColor', mainPaneColor);
    set({ mainPaneColor });
  },
  setBranchPaneColor: (branchPaneColor) => {
    writePreference('branchPaneColor', branchPaneColor);
    set({ branchPaneColor });
  },
  setChatFontSize: (chatFontSize) => {
    const next = Math.min(18, Math.max(12, Number(chatFontSize)));
    writePreference('chatFontSize', next);
    set({ chatFontSize: next });
  },

  syncWorkspace: async ({ boot = false } = {}) => {
    if (boot) {
      set({ bootstrapping: true, error: '' });
    }
    try {
      const [providers, conversations] = await Promise.all([
        api.listProviders(),
        api.listConversations(),
      ]);
      let nextConversations = conversations;
      if (nextConversations.length === 0) {
        const created = await api.createConversation({ title: defaultConversationTitle(get().locale) });
        nextConversations = [created];
      }
      const state = get();
      const activeId = state.activeConversation?.id;
      const target = nextConversations.find((conversation) => conversation.id === activeId)
        || nextConversations[0];
      const selectedProviderId = chooseProvider(providers, state.selectedProviderId);
      const { detail, branch: openBranch } = await hydrateConversation(target.id);
      let branch = openBranch;
      if (state.activeBranch?.id) {
        try {
          branch = await api.getBranch(state.activeBranch.id);
        } catch {
          branch = openBranch;
        }
      }
      const safeDetail = applyConversationDetailSafely(detail, get());
      set({
        providers,
        conversations: nextConversations,
        selectedProviderId,
        branchProviderId: chooseProvider(providers, state.branchProviderId || selectedProviderId),
        ...safeDetail,
        isParallelMode: Boolean(branch),
        activeBranch: branch,
        branchMessages: state.branchLoading ? state.branchMessages : branch?.messages || [],
        syncMemory: branch?.sync_memory ?? state.syncMemory,
        bootstrapping: false,
      });
    } catch (error) {
      set({ error: userFacingError(error), bootstrapping: false });
    }
  },

  bootstrap: async () => {
    if (bootstrapPromise) {
      return bootstrapPromise;
    }
    bootstrapPromise = (async () => {
      try {
        await get().syncWorkspace({ boot: true });
      } finally {
        bootstrapPromise = null;
      }
    })();
    return bootstrapPromise;
  },

  refreshProviders: async () => {
    const providers = await api.listProviders();
    set({
      providers,
      selectedProviderId: chooseProvider(providers, get().selectedProviderId),
      branchProviderId: chooseProvider(providers, get().branchProviderId),
    });
  },

  createProvider: async (payload) => {
    const created = await api.createProvider(payload);
    const providers = await api.listProviders();
    set({
      providers,
      selectedProviderId: chooseProvider(providers, created.id),
      branchProviderId: chooseProvider(providers, get().branchProviderId || created.id),
    });
    return created;
  },

  updateProvider: async (providerId, payload) => {
    const updated = await api.updateProvider(providerId, payload);
    const providers = await api.listProviders();
    set({
      providers,
      selectedProviderId: chooseProvider(providers, get().selectedProviderId || updated.id),
      branchProviderId: chooseProvider(providers, get().branchProviderId || updated.id),
    });
    return updated;
  },

  setDefaultProvider: async (providerId) => {
    await api.updateProvider(providerId, { is_default: true });
    const providers = await api.listProviders();
    set({ providers, selectedProviderId: providerId });
  },

  deleteProvider: async (providerId) => {
    await api.deleteProvider(providerId);
    const providers = await api.listProviders();
    set({
      providers,
      selectedProviderId: chooseProvider(providers, get().selectedProviderId),
      branchProviderId: chooseProvider(providers, get().branchProviderId),
    });
  },

  testProvider: async (providerId) => api.testProvider(providerId),

  refreshConversations: async () => {
    const conversations = await api.listConversations();
    set({ conversations });
  },

  createConversation: async () => {
    set({ error: '' });
    try {
      const conversation = await api.createConversation({ title: defaultConversationTitle(get().locale) });
      const conversations = await api.listConversations();
      const detail = await api.getConversation(conversation.id);
      set({
        conversations,
        ...applyConversationDetail(detail),
        isParallelMode: false,
        activeBranch: null,
        branchMessages: [],
        syncMemory: false,
      });
    } catch (error) {
      set({ error: userFacingError(error) });
    }
  },

  selectConversation: async (conversationId) => {
    set({ error: '' });
    try {
      const { detail, branch } = await hydrateConversation(conversationId);
      set({
        ...applyConversationDetail(detail),
        isParallelMode: Boolean(branch),
        activeBranch: branch,
        branchMessages: branch?.messages || [],
        syncMemory: branch?.sync_memory || false,
      });
    } catch (error) {
      set({ error: userFacingError(error) });
    }
  },

  deleteConversation: async (conversationId) => {
    set({ error: '' });
    try {
      await api.deleteConversation(conversationId);
      let conversations = await api.listConversations();
      if (conversations.length === 0) {
        const created = await api.createConversation({ title: defaultConversationTitle(get().locale) });
        conversations = [created];
      }
      const detail = await api.getConversation(conversations[0].id);
      set({
        conversations,
        ...applyConversationDetail(detail),
        isParallelMode: false,
        activeBranch: null,
        branchMessages: [],
      });
    } catch (error) {
      set({ error: userFacingError(error) });
    }
  },

  sendMainMessage: async (content, options = {}) => {
    const { activeConversation, selectedProviderId, messages } = get();
    if (!activeConversation || !content.trim()) return;
    mainAbortController?.abort();
    mainAbortController = new AbortController();

    let assistantId = null;
    const optimisticUser = optimisticMessage('user', content.trim(), 'main');
    const optimisticAssistant = optimisticMessage('assistant', '', 'main');
    assistantId = optimisticAssistant.id;
    const baseMessages = options.replaceFromMessageId
      ? truncateFromMessage(messages, options.replaceFromMessageId)
      : messages;

    set({
      messages: [...baseMessages, optimisticUser, optimisticAssistant],
      mainLoading: true,
      error: '',
    });

    try {
      await api.streamMainMessage(
        {
          conversation_id: activeConversation.id,
          provider_id: selectedProviderId,
          content: content.trim(),
          replace_from_message_id: options.replaceFromMessageId || null,
        },
        {
          signal: mainAbortController.signal,
          onEvent: (event) => {
            if (event.type === 'user') {
              set((state) => ({
                messages: state.messages.map((message) => (
                  message.id === optimisticUser.id ? event.data.message : message
                )),
              }));
            }
            if (event.type === 'assistant_start') {
              assistantId = event.data.message.id;
              set((state) => ({
                messages: state.messages.map((message) => (
                  message.id === optimisticAssistant.id ? event.data.message : message
                )),
              }));
            }
            if (event.type === 'delta') {
              set((state) => ({
                messages: appendDelta(state.messages, assistantId, event.data.content),
              }));
            }
            if (event.type === 'done') {
              set({
                ...applyConversationDetail(event.data.conversation),
              });
            }
          },
        },
      );
      const conversations = await api.listConversations();
      set({ conversations, mainLoading: false });
    } catch (error) {
      if (error.name !== 'AbortError') {
        set({ error: userFacingError(error) });
      }
      set({ mainLoading: false });
    } finally {
      mainAbortController = null;
    }
  },

  stopMainGeneration: () => {
    mainAbortController?.abort();
    mainAbortController = null;
    set({ mainLoading: false });
  },

  openBranch: async (options = {}) => {
    const { activeConversation, messages, syncMemory } = get();
    if (!activeConversation) return;
    set({ error: '' });
    try {
      const rawParentId = options.parentId || messages[messages.length - 1]?.id || null;
      const parentId = rawParentId?.startsWith?.('local_') ? null : rawParentId;
      const branch = await api.createBranch({
        conversation_id: activeConversation.id,
        parent_id: parentId,
        sync_memory: syncMemory,
        selected_text: options.selectedText || null,
      });
      const detail = await api.getConversation(activeConversation.id);
      const safeDetail = applyConversationDetailSafely(detail, get());
      set({
        ...safeDetail,
        isParallelMode: true,
        activeBranch: branch,
        branchMessages: branch.messages || [],
        syncMemory: branch.sync_memory,
      });
    } catch (error) {
      set({ error: userFacingError(error) });
    }
  },

  openExistingBranch: async (branchId) => {
    set({ error: '' });
    try {
      const branch = await api.getBranch(branchId);
      set({
        isParallelMode: true,
        activeBranch: branch,
        branchMessages: branch.messages || [],
        syncMemory: branch.sync_memory,
      });
    } catch (error) {
      set({ error: userFacingError(error) });
    }
  },

  sendBranchMessage: async (content, options = {}) => {
    const { activeBranch, selectedProviderId, branchProviderId, branchMessages } = get();
    if (!activeBranch || activeBranch.status !== 'open' || !content.trim()) return;
    branchAbortController?.abort();
    branchAbortController = new AbortController();

    let assistantId = null;
    const optimisticUser = optimisticMessage('user', content.trim(), 'branch');
    const optimisticAssistant = optimisticMessage('assistant', '', 'branch');
    assistantId = optimisticAssistant.id;
    const baseMessages = options.replaceFromMessageId
      ? truncateFromMessage(branchMessages, options.replaceFromMessageId)
      : branchMessages;

    set({
      branchMessages: [...baseMessages, optimisticUser, optimisticAssistant],
      branchLoading: true,
      error: '',
    });

    try {
      await api.streamParallelMessage(
        {
          branch_id: activeBranch.id,
          provider_id: branchProviderId || selectedProviderId,
          content: content.trim(),
          replace_from_message_id: options.replaceFromMessageId || null,
        },
        {
          signal: branchAbortController.signal,
          onEvent: (event) => {
            if (event.type === 'user') {
              set((state) => ({
                branchMessages: state.branchMessages.map((message) => (
                  message.id === optimisticUser.id ? event.data.message : message
                )),
              }));
            }
            if (event.type === 'assistant_start') {
              assistantId = event.data.message.id;
              set((state) => ({
                branchMessages: state.branchMessages.map((message) => (
                  message.id === optimisticAssistant.id ? event.data.message : message
                )),
              }));
            }
            if (event.type === 'delta') {
              set((state) => ({
                branchMessages: appendDelta(state.branchMessages, assistantId, event.data.content),
              }));
            }
            if (event.type === 'done') {
              set({
                activeBranch: event.data.branch,
                branchMessages: event.data.branch.messages,
              });
            }
          },
        },
      );
      set({ branchLoading: false });
    } catch (error) {
      if (error.name !== 'AbortError') {
        set({ error: userFacingError(error) });
      }
      set({ branchLoading: false });
    } finally {
      branchAbortController = null;
    }
  },

  stopBranchGeneration: () => {
    branchAbortController?.abort();
    branchAbortController = null;
    set({ branchLoading: false });
  },

  closeBranch: async () => {
    const { activeBranch, syncMemory, branchProviderId, selectedProviderId } = get();
    if (!activeBranch) {
      set({ isParallelMode: false });
      return;
    }
    if (activeBranch.status !== 'open') {
      set({ isParallelMode: false, activeBranch: null, branchMessages: [] });
      return;
    }
    set({ error: '' });
    try {
      const detail = await api.closeBranch(activeBranch.id, {
        sync_memory: syncMemory,
        provider_id: branchProviderId || selectedProviderId,
      });
      const conversations = await api.listConversations();
      const safeDetail = applyConversationDetailSafely(detail, get());
      set({
        conversations,
        ...safeDetail,
        isParallelMode: false,
        activeBranch: null,
        branchMessages: [],
      });
    } catch (error) {
      set({ error: userFacingError(error) });
    }
  },
}));

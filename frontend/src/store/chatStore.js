import { create } from 'zustand';
import { api } from '../api/client';

const initialState = {
  bootstrapping: true,
  providers: [],
  conversations: [],
  activeConversation: null,
  messages: [],
  hiddenMemoryCount: 0,
  selectedProviderId: null,
  isParallelMode: false,
  activeBranch: null,
  branchMessages: [],
  syncMemory: false,
  paneWidth: 56,
  settingsOpen: false,
  mainLoading: false,
  branchLoading: false,
  error: '',
};

function chooseProvider(providers, currentId) {
  if (providers.some((provider) => provider.id === currentId)) {
    return currentId;
  }
  return providers.find((provider) => provider.is_default)?.id || providers[0]?.id || null;
}

async function hydrateConversation(conversationId) {
  const detail = await api.getConversation(conversationId);
  let branch = null;
  if (detail.open_branch_id) {
    branch = await api.getBranch(detail.open_branch_id);
  }
  return { detail, branch };
}

export const useChatStore = create((set, get) => ({
  ...initialState,

  setError: (error) => set({ error }),
  clearError: () => set({ error: '' }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPaneWidth: (paneWidth) => set({ paneWidth: Math.min(66, Math.max(42, paneWidth)) }),
  setSyncMemory: (syncMemory) => set({ syncMemory }),

  bootstrap: async () => {
    set({ bootstrapping: true, error: '' });
    try {
      const [providers, conversations] = await Promise.all([
        api.listProviders(),
        api.listConversations(),
      ]);
      let nextConversations = conversations;
      if (nextConversations.length === 0) {
        const created = await api.createConversation({ title: '新的平行对话' });
        nextConversations = [created];
      }
      const { detail, branch } = await hydrateConversation(nextConversations[0].id);
      set({
        providers,
        conversations: nextConversations,
        selectedProviderId: chooseProvider(providers, get().selectedProviderId),
        activeConversation: detail.conversation,
        messages: detail.messages,
        hiddenMemoryCount: detail.hidden_memory_count,
        isParallelMode: Boolean(branch),
        activeBranch: branch,
        branchMessages: branch?.messages || [],
        syncMemory: branch?.sync_memory || false,
        bootstrapping: false,
      });
    } catch (error) {
      set({ error: error.message, bootstrapping: false });
    }
  },

  refreshProviders: async () => {
    const providers = await api.listProviders();
    set({ providers, selectedProviderId: chooseProvider(providers, get().selectedProviderId) });
  },

  createProvider: async (payload) => {
    const created = await api.createProvider(payload);
    const providers = await api.listProviders();
    set({
      providers,
      selectedProviderId: chooseProvider(providers, created.id),
    });
    return created;
  },

  setDefaultProvider: async (providerId) => {
    await api.updateProvider(providerId, { is_default: true });
    const providers = await api.listProviders();
    set({ providers, selectedProviderId: providerId });
  },

  deleteProvider: async (providerId) => {
    await api.deleteProvider(providerId);
    const providers = await api.listProviders();
    set({ providers, selectedProviderId: chooseProvider(providers, get().selectedProviderId) });
  },

  testProvider: async (providerId) => api.testProvider(providerId),

  refreshConversations: async () => {
    const conversations = await api.listConversations();
    set({ conversations });
  },

  createConversation: async () => {
    set({ error: '' });
    try {
      const conversation = await api.createConversation({ title: '新的平行对话' });
      const conversations = await api.listConversations();
      const detail = await api.getConversation(conversation.id);
      set({
        conversations,
        activeConversation: detail.conversation,
        messages: detail.messages,
        hiddenMemoryCount: detail.hidden_memory_count,
        isParallelMode: false,
        activeBranch: null,
        branchMessages: [],
        syncMemory: false,
      });
    } catch (error) {
      set({ error: error.message });
    }
  },

  selectConversation: async (conversationId) => {
    set({ error: '' });
    try {
      const { detail, branch } = await hydrateConversation(conversationId);
      set({
        activeConversation: detail.conversation,
        messages: detail.messages,
        hiddenMemoryCount: detail.hidden_memory_count,
        isParallelMode: Boolean(branch),
        activeBranch: branch,
        branchMessages: branch?.messages || [],
        syncMemory: branch?.sync_memory || false,
      });
    } catch (error) {
      set({ error: error.message });
    }
  },

  deleteConversation: async (conversationId) => {
    set({ error: '' });
    try {
      await api.deleteConversation(conversationId);
      let conversations = await api.listConversations();
      if (conversations.length === 0) {
        const created = await api.createConversation({ title: '新的平行对话' });
        conversations = [created];
      }
      const detail = await api.getConversation(conversations[0].id);
      set({
        conversations,
        activeConversation: detail.conversation,
        messages: detail.messages,
        hiddenMemoryCount: detail.hidden_memory_count,
        isParallelMode: false,
        activeBranch: null,
        branchMessages: [],
      });
    } catch (error) {
      set({ error: error.message });
    }
  },

  sendMainMessage: async (content) => {
    const { activeConversation, selectedProviderId } = get();
    if (!activeConversation || !content.trim()) return;
    set({ mainLoading: true, error: '' });
    try {
      const response = await api.sendMainMessage({
        conversation_id: activeConversation.id,
        provider_id: selectedProviderId,
        content: content.trim(),
      });
      const conversations = await api.listConversations();
      set({
        activeConversation: response.conversation.conversation,
        messages: response.conversation.messages,
        hiddenMemoryCount: response.conversation.hidden_memory_count,
        conversations,
        mainLoading: false,
      });
    } catch (error) {
      set({ error: error.message, mainLoading: false });
    }
  },

  openBranch: async () => {
    const { activeConversation, activeBranch, syncMemory } = get();
    if (!activeConversation) return;
    if (activeBranch?.status === 'open') {
      set({ isParallelMode: true });
      return;
    }
    set({ error: '' });
    try {
      const branch = await api.createBranch({
        conversation_id: activeConversation.id,
        sync_memory: syncMemory,
      });
      set({
        isParallelMode: true,
        activeBranch: branch,
        branchMessages: branch.messages || [],
        syncMemory: branch.sync_memory,
      });
    } catch (error) {
      set({ error: error.message });
    }
  },

  sendBranchMessage: async (content) => {
    const { activeBranch, selectedProviderId } = get();
    if (!activeBranch || !content.trim()) return;
    set({ branchLoading: true, error: '' });
    try {
      const branch = await api.sendParallelMessage({
        branch_id: activeBranch.id,
        provider_id: selectedProviderId,
        content: content.trim(),
      });
      set({
        activeBranch: branch,
        branchMessages: branch.messages,
        branchLoading: false,
      });
    } catch (error) {
      set({ error: error.message, branchLoading: false });
    }
  },

  closeBranch: async () => {
    const { activeBranch, syncMemory } = get();
    if (!activeBranch) {
      set({ isParallelMode: false });
      return;
    }
    set({ error: '' });
    try {
      const detail = await api.closeBranch(activeBranch.id, { sync_memory: syncMemory });
      const conversations = await api.listConversations();
      set({
        conversations,
        activeConversation: detail.conversation,
        messages: detail.messages,
        hiddenMemoryCount: detail.hidden_memory_count,
        isParallelMode: false,
        activeBranch: null,
        branchMessages: [],
      });
    } catch (error) {
      set({ error: error.message });
    }
  },
}));


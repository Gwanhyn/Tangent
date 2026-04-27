import { Check, FlaskConical, KeyRound, Pencil, Plus, RotateCcw, Save, Server, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useChatStore } from '../store/chatStore';

const providerTypes = [
  { value: 'dashscope', label: 'DashScope', hint: '模型示例：dashscope/qwen-plus' },
  { value: 'deepseek', label: 'DeepSeek', hint: '模型示例：deepseek/deepseek-chat' },
  { value: 'openai', label: 'OpenAI', hint: '模型示例：gpt-4.1-mini' },
  { value: 'gemini', label: 'Gemini', hint: '模型示例：gemini/gemini-2.0-flash' },
  { value: 'azure_openai', label: 'Azure OpenAI', hint: '填写 Azure endpoint 与部署名' },
  { value: 'custom', label: '自定义 OpenAI 兼容', hint: '填写 Base URL 与模型名' },
];

const defaults = {
  name: '',
  provider_type: 'openai',
  base_url: '',
  api_key: '',
  model_name: '',
  temperature: 0.7,
  max_tokens: 1200,
  is_default: true,
};

export default function ProviderPanel() {
  const {
    providers,
    selectedProviderId,
    setSettingsOpen,
    createProvider,
    updateProvider,
    setDefaultProvider,
    deleteProvider,
    testProvider,
  } = useChatStore();
  const [form, setForm] = useState(defaults);
  const [editingProviderId, setEditingProviderId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const selectedType = useMemo(
    () => providerTypes.find((item) => item.value === form.provider_type),
    [form.provider_type],
  );

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const resetForm = () => {
    setForm(defaults);
    setEditingProviderId(null);
  };

  const startEdit = (provider) => {
    setEditingProviderId(provider.id);
    setNotice('');
    setForm({
      name: provider.name,
      provider_type: provider.provider_type,
      base_url: provider.base_url || '',
      api_key: '',
      model_name: provider.model_name,
      temperature: provider.temperature,
      max_tokens: provider.max_tokens,
      is_default: provider.is_default,
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const payload = {
        ...form,
        base_url: form.base_url.trim() || null,
        api_key: form.api_key.trim() || null,
        temperature: Number(form.temperature),
        max_tokens: Number(form.max_tokens),
      };
      if (editingProviderId) {
        if (!form.api_key.trim()) {
          delete payload.api_key;
        }
        await updateProvider(editingProviderId, payload);
        resetForm();
        setNotice('Provider 配置已更新，下一次请求会使用新配置。');
      } else {
        await createProvider(payload);
        resetForm();
        setNotice('Provider 已保存，可以发送真实模型请求了。');
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (providerId) => {
    setBusy(true);
    setNotice('');
    try {
      const result = await testProvider(providerId);
      setNotice(`连接成功：${result.message}`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="settings-drawer">
      <div className="settings-panel">
        <header className="settings-header">
          <div>
            <p className="eyebrow">Provider Manager</p>
            <h2>{editingProviderId ? '修改模型配置' : '模型池管理'}</h2>
            <p>
              {editingProviderId
                ? '正在编辑已有 Provider。API Key 留空会保留原值，填写新 Key 才会替换。'
                : 'API Key 只保存在本地后端数据库中，前端列表仅显示是否已配置。'}
            </p>
          </div>
          <button className="icon-button" onClick={() => setSettingsOpen(false)} type="button">
            <X size={19} />
          </button>
        </header>

        <form className="provider-form" onSubmit={submit}>
          <label>
            名称
            <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="例如：OpenAI 主力" required />
          </label>
          <label>
            厂商
            <select value={form.provider_type} onChange={(event) => update('provider_type', event.target.value)}>
              {providerTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <span>{selectedType?.hint}</span>
          </label>
          <label>
            Base URL
            <input value={form.base_url} onChange={(event) => update('base_url', event.target.value)} placeholder="可选：OpenAI 兼容网关或 Azure endpoint" />
          </label>
          <label>
            API Key
            <input
              value={form.api_key}
              onChange={(event) => update('api_key', event.target.value)}
              placeholder={editingProviderId ? '留空表示保留原 API Key' : 'sk-...'}
              type="password"
            />
          </label>
          <label>
            Model Name
            <input value={form.model_name} onChange={(event) => update('model_name', event.target.value)} placeholder="例如：gpt-4.1-mini" required />
          </label>
          <div className="provider-grid">
            <label>
              Temperature
              <input value={form.temperature} onChange={(event) => update('temperature', event.target.value)} min="0" max="2" step="0.1" type="number" />
            </label>
            <label>
              Max Tokens
              <input value={form.max_tokens} onChange={(event) => update('max_tokens', event.target.value)} min="1" type="number" />
            </label>
          </div>
          <label className="check-line">
            <input checked={form.is_default} onChange={(event) => update('is_default', event.target.checked)} type="checkbox" />
            设为默认 Provider
          </label>
          <div className="provider-form-actions">
            <button className="primary-wide" disabled={busy} type="submit">
              {editingProviderId ? <Save size={17} /> : <Plus size={17} />}
              {editingProviderId ? '保存修改' : '添加 Provider'}
            </button>
            {editingProviderId && (
              <button className="secondary-wide" disabled={busy} onClick={resetForm} type="button">
                <RotateCcw size={17} />
                取消编辑
              </button>
            )}
          </div>
        </form>

        {notice && <div className="notice">{notice}</div>}

        <div className="provider-list">
          {providers.length === 0 ? (
            <div className="provider-empty">
              <KeyRound size={26} />
              <strong>还没有 Provider</strong>
              <span>添加一个真实 API Key 后，主线和衍生窗口会共用它来调用模型。</span>
            </div>
          ) : (
            providers.map((provider) => (
              <article className={`provider-card ${provider.id === selectedProviderId ? 'provider-selected' : ''}`} key={provider.id}>
                <div className="provider-icon"><Server size={18} /></div>
                <div className="provider-copy">
                  <strong>{provider.name}</strong>
                  <span>{provider.provider_type} · {provider.model_name}</span>
                  <small>{provider.has_api_key ? '已配置 API Key' : '未配置 API Key'}{provider.base_url ? ` · ${provider.base_url}` : ''}</small>
                </div>
                <div className="provider-actions">
                  <button type="button" onClick={() => startEdit(provider)} title="编辑配置">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => setDefaultProvider(provider.id)} title="设为当前默认">
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => runTest(provider.id)} title="测试连接">
                    <FlaskConical size={16} />
                  </button>
                  <button type="button" onClick={() => deleteProvider(provider.id)} title="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

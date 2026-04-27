import { X } from 'lucide-react';
import { useCopy } from '../i18n';
import { useChatStore } from '../store/chatStore';
import PrettySelect from './PrettySelect';

export default function PreferencesPanel() {
  const copy = useCopy();
  const {
    locale,
    mainPaneColor,
    branchPaneColor,
    chatFontSize,
    sendShortcut,
    branchMarkerMode,
    setSettingsOpen,
    setLocale,
    setMainPaneColor,
    setBranchPaneColor,
    setChatFontSize,
    setSendShortcut,
    setBranchMarkerMode,
  } = useChatStore();

  return (
    <aside className="settings-drawer">
      <div className="settings-panel preferences-panel">
        <header className="settings-header">
          <div>
            <p className="eyebrow">{copy.preferences.eyebrow}</p>
            <h2>{copy.preferences.title}</h2>
            <p>{copy.preferences.description}</p>
          </div>
          <button className="icon-button" onClick={() => setSettingsOpen(false)} type="button">
            <X size={19} />
          </button>
        </header>

        <section className="preference-card">
          <div className="preference-heading">
            <strong>{copy.settings.colorMode}</strong>
            <span>{copy.settings.fontSize}: {chatFontSize}px</span>
          </div>
          <div className="preference-grid">
            <PrettySelect
              label={copy.settings.language}
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'zh', label: '中文', description: '简体中文界面' },
                { value: 'en', label: 'English', description: 'English interface' },
              ]}
            />
            <label>
              {copy.settings.primaryColor}
              <input value={mainPaneColor} onChange={(event) => setMainPaneColor(event.target.value)} type="color" />
            </label>
            <label>
              {copy.settings.branchColor}
              <input value={branchPaneColor} onChange={(event) => setBranchPaneColor(event.target.value)} type="color" />
            </label>
            <label>
              {copy.settings.fontSize}
              <input
                value={chatFontSize}
                min="12"
                max="18"
                onChange={(event) => setChatFontSize(event.target.value)}
                type="range"
              />
            </label>
            <PrettySelect
              label={copy.settings.sendShortcut}
              value={sendShortcut}
              onChange={setSendShortcut}
              options={[
                { value: 'enter', label: copy.settings.enterToSend, description: copy.settings.shiftEnterHint },
                { value: 'ctrlEnter', label: copy.settings.ctrlEnterToSend, description: copy.settings.enterNewlineHint },
              ]}
            />
            <PrettySelect
              label={copy.settings.branchMarkerMode}
              value={branchMarkerMode}
              onChange={setBranchMarkerMode}
              options={[
                { value: 'compact', label: copy.settings.branchMarkerCompact, description: copy.settings.branchMarkerCompactHint },
                { value: 'full', label: copy.settings.branchMarkerFull, description: copy.settings.branchMarkerFullHint },
              ]}
            />
          </div>
        </section>
      </div>
    </aside>
  );
}

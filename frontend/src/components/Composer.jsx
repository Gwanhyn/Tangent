import { SendHorizontal } from 'lucide-react';
import { useState } from 'react';

export default function Composer({
  onSend,
  loading,
  disabled,
  placeholder,
  sendLabel = '发送',
  generatingLabel = '生成中',
  sendShortcut = 'enter',
}) {
  const [value, setValue] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || loading || disabled) return;
    setValue('');
    await onSend(text);
  };

  return (
    <form onSubmit={submit} className="composer">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          const wantsEnterSend = sendShortcut === 'enter' && event.key === 'Enter' && !event.shiftKey;
          const wantsCtrlEnterSend = sendShortcut === 'ctrlEnter'
            && event.key === 'Enter'
            && (event.metaKey || event.ctrlKey);
          if (wantsEnterSend || wantsCtrlEnterSend) {
            submit(event);
          }
        }}
        disabled={disabled || loading}
        placeholder={placeholder}
        rows={3}
        className="composer-input"
      />
      <button className="send-button" disabled={disabled || loading || !value.trim()} type="submit">
        <SendHorizontal size={18} />
        <span>{loading ? generatingLabel : sendLabel}</span>
      </button>
    </form>
  );
}

import { useChatStore } from '../store/chatStore';
import en from './en.json';
import zh from './zh.json';

export const dictionaries = { en, zh };

export function useCopy() {
  const locale = useChatStore((state) => state.locale);
  return dictionaries[locale] || dictionaries.zh;
}

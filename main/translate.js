'use strict';

// Translate: the only mini app that needs the internet. The text goes to MyMemory
// (api.mymemory.translated.net, free, no account), and nothing else is sent with it.
const { net } = require('electron');

const MAX_TEXT = 500; // MyMemory's limit per request
const TIMEOUT_MS = 8000;
const LANGS = new Set(['en', 'fr', 'es', 'ar', 'de', 'it', 'pt', 'nl', 'tr', 'ru', 'uk', 'pl', 'sv', 'zh-CN', 'ja', 'ko', 'hi']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const decode = (text) => text.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m, name) => ENTITIES[name]);

async function translate(text, from, to) {
  const q = String(text || '').trim().slice(0, MAX_TEXT);
  if (!q) return { text: '' };
  if (!LANGS.has(to) || (from !== 'auto' && !LANGS.has(from))) return { error: 'lang' };
  if (from === to) return { text: q };
  const url = 'https://api.mymemory.translated.net/get?' +
    new URLSearchParams({ q, langpair: (from === 'auto' ? 'autodetect' : from) + '|' + to }).toString();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await net.fetch(url, { signal: abort.signal });
    if (!res.ok) return { error: res.status === 429 ? 'quota' : 'service' };
    const data = await res.json();
    if (data.quotaFinished) return { error: 'quota' };
    const out = data.responseData && data.responseData.translatedText;
    if (Number(data.responseStatus) !== 200 || typeof out !== 'string') return { error: 'service' };
    const detected = typeof data.responseData.detectedLanguage === 'string' ? data.responseData.detectedLanguage : null;
    return { text: decode(out), detected, cut: String(text).trim().length > MAX_TEXT };
  } catch (err) {
    return { error: 'net' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { translate, LANGS, MAX_TEXT };

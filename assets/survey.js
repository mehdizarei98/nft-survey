// Public survey form (v4.4). Vanilla ES modules, no build step.
// Questions/options come from survey.json, wording of every other text from content.json
// (both generated from the approved files; nothing is hand-typed here). Strings marked
// "chrome" below are interface texts that are not part of the questionnaire.
import {
  CHANNELS, isShown, visibleCodes, normalize, roleOf, optionOrder, shownOptionOrders, missingRequiredIds,
} from './lib/model.js';

// ============================================================ PRE-LAUNCH CONFIG
// Fill these in before publishing (see README, "فهرست پیش از انتشار").
export const CONFIG = {
  // Base URL of the Cloudflare Worker, no trailing slash, e.g. 'https://survey-api.example.ir'.
  // Empty = not configured. On localhost the form falls back to http://localhost:8787 (wrangler dev).
  API_BASE: 'https://nft-survey-api.cezar98.workers.dev',
  // Owner decision 2026-10-13: show supplied researcher/contact; omit unfilled lines.
  SHOW_RESEARCHER: true,
  // Researcher block shown in the introduction when SHOW_RESEARCHER is true. '..........' = placeholder.
  RESEARCHER: 'مهدی زارعی',
  UNIVERSITY: '..........',
  SUPERVISOR: '..........',
  CONTACT: 'mehdi.zarei@mail.ir',
  // null = use the first two intro paragraphs (purpose; voluntary/no-personal-data) of the approved
  // questionnaire as written. Otherwise a shorter wording of the same points (owner decision 2026-10-13).
  INTRO_TEXT: [
    'این پژوهش برای شناخت نیازهای کاربران ایرانی و طراحی یک بازار NFT انجام می‌شود. تجربهٔ قبلی لازم نیست و پاسخ درست یا غلط وجود ندارد.',
    'شرکت داوطلبانه است و تا پیش از ارسال می‌توانید منصرف شوید. پاسخ به همهٔ سؤال‌های نمایش‌داده‌شده، به‌جز نظر متنی پایانی، لازم است؛ می‌توانید از گزینه‌های «نمی‌دانم»، «نامرتبط» یا «ترجیح می‌دهم پاسخ ندهم» در سؤال‌های مربوط استفاده کنید. نام، اطلاعات حساب، آدرس کیف پول یا مدرک هویتی پرسیده نمی‌شود؛ در پاسخ‌های متنی هم اطلاعات شناسایی ننویسید. چون پاسخ‌ها بی‌نام‌اند، پس از ارسال نمی‌توان پاسخ شما را پیدا و حذف کرد.',
  ],
  // Owner decision 2026-10-13; also recorded in input/survey_v4_4.md.
  RETENTION_TEXT: 'داده‌ها فقط در دسترس پژوهشگر است، تا پایان دفاع از پایان‌نامه نگهداری و پس از آن حذف می‌شود. نتایج فقط به‌صورت گروهی و بدون هیچ اطلاعات شناسایی گزارش می‌شوند.',
  // Test phase: while set, this one paragraph replaces the first three intro paragraphs (purpose,
  // voluntary/no-personal-data text, retention). Set to null before the public launch.
  TEST_NOTICE: null,
  TEST_NOTICE_DETAIL: null,
};
// ===========================================================================

const PLACEHOLDER = '..........';
const DRAFT_KEY = 'nft-survey:4.4:draft';
const SUBMIT_TIMEOUT_MS = 20000;

// Page order of the public form (guide §3); a page is shown only if one of its questions is.
const PAGES = [
  { id: 'p1', ids: ['A01'] },
  { id: 'p2', ids: ['A02', 'A03', 'A04', 'A05'], definition: true },
  { id: 'p3', ids: ['E01', 'E02', 'E03', 'E04', 'N01'] },
  { id: 'p4', ids: ['B01', 'C01'] },
  { id: 'p5', ids: ['L01', 'L02', 'L03', 'L05'] },
  { id: 'p6', ids: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'B02', 'C02'] },
  { id: 'p7', ids: ['P01', 'D01', 'D02', 'D03', 'Z01'] },
];

// chrome texts
const T = {
  loading: 'در حال بارگذاری پرسشنامه…',
  loadFail: 'بارگذاری پرسشنامه ناموفق بود. اتصال اینترنت را بررسی کنید و صفحه را دوباره باز کنید.',
  placeholderBanner: 'نسخه آزمایشی: مشخصات پژوهشگر یا نشانی سرویس ارسال هنوز تکمیل نشده است. این پیام پس از تکمیل تنظیمات در ابتدای survey.js ناپدید می‌شود.',
  resumeText: 'پاسخ‌های نیمه‌تمام شما روی همین دستگاه ذخیره شده است.',
  resume: 'ادامه از همان‌جا',
  restart: 'شروع دوباره',
  needConfirm: 'برای شروع، هر دو تأیید لازم است.',
  progress: (n, total) => `بخش ${fa(n)} از ${fa(total)}`,
  reviewLabel: 'مرور و ارسال',
  back: 'قبلی',
  next: 'ادامه',
  clear: 'پاک کردن انتخاب',
  maxReached: (max) => `حداکثر ${fa(max)} گزینه انتخاب شده است؛ برای انتخاب گزینه دیگر، یکی از گزینه‌های انتخاب‌شده را بردارید.`,
  reviewHeading: 'مرور پاسخ‌ها',
  reviewHint: 'پاسخ‌ها را مرور کنید. فقط نظر متنی پایانی اختیاری است. اگر آماده‌اید، پاسخ‌ها را ارسال کنید.',
  required: 'لطفاً به این سؤال پاسخ دهید.',
  requiredMultiple: 'لطفاً دست‌کم یک گزینه برای این سؤال انتخاب کنید.',
  noAnswer: 'بدون پاسخ',
  edit: 'ویرایش',
  submit: 'ارسال پاسخ‌ها',
  sending: 'در حال ارسال…',
  retry: 'تلاش دوباره برای ارسال',
  netError: 'ارسال انجام نشد. اتصال اینترنت را بررسی کنید؛ پاسخ‌های شما روی همین دستگاه نگه‌داشته شده و پس از اتصال می‌توانید دوباره تلاش کنید.',
  noApi: 'نشانی سرویس ارسال هنوز تنظیم نشده است؛ ارسال ممکن نیست.',
  tooFast: 'پاسخ‌ها خیلی زود پس از شروع ارسال شد و ثبت نشد. لطفاً پاسخ‌ها را مرور کنید و دوباره ارسال کنید.',
  rejected: 'ارسال پذیرفته نشد. اگر مشکل ادامه داشت، از راه ارتباطی پژوهشگر خبر دهید.',
  invalid: 'پاسخ‌ها برای ثبت معتبر نبود. صفحه را دوباره باز کنید و ارسال را تکرار کنید.',
  thanksDone: 'پاسخ شما ثبت شد.',
};

let survey;
let content;
const qById = {};
const state = {
  phase: 'intro', // intro | page | review | done
  pageId: 'p1',
  answers: {},
  conf: { G01: false, G02: false },
  startedAt: null,
  responseId: null,
  channel: '',
  pending: null, // payload frozen at the first submit attempt (kept for retry)
};

// ------------------------------------------------------------ helpers
const fa = (n) => Number(n).toLocaleString('fa-IR');
const app = () => document.getElementById('app');

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'value') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

const store = {
  get() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } },
  set(v) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch { /* storage unavailable: form still works */ } },
  clear() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } },
};

function saveDraft() {
  if (state.phase === 'intro' || state.phase === 'done') return;
  store.set({
    v: survey.version, savedAt: Date.now(), phase: state.phase, pageId: state.pageId, answers: state.answers,
    conf: state.conf, startedAt: state.startedAt, responseId: state.responseId, channel: state.channel, pending: state.pending,
  });
}
let textTimer = null;
const saveDraftSoon = () => { clearTimeout(textTimer); textTimer = setTimeout(saveDraft, 400); };

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function channelFromUrl() {
  const raw = new URLSearchParams(location.search).get('c');
  if (raw === null || raw.trim() === '') return '';
  const c = raw.trim().toLowerCase();
  return CHANNELS.includes(c) ? c : 'other';
}

const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

function apiBase() {
  if (isLocalHost()) {
    const override = new URLSearchParams(location.search).get('api'); // dev only, ignored on public hosts
    if (override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override)) return override;
    return CONFIG.API_BASE || 'http://localhost:8787';
  }
  return CONFIG.API_BASE;
}

const hasPlaceholders = () => [CONFIG.RESEARCHER, CONFIG.CONTACT].some((v) => !v?.trim() || v === PLACEHOLDER) || !apiBase();

// ------------------------------------------------------------ flow
const visiblePages = (answers) => PAGES.filter((p) => p.ids.some((id) => isShown(survey, id, answers)));

function pageIndex(id, answers = state.answers) {
  const pages = visiblePages(answers);
  return { pages, index: pages.findIndex((p) => p.id === id) };
}

function go(phase, pageId) {
  state.phase = phase;
  if (pageId) state.pageId = pageId;
  saveDraft();
  render();
  window.scrollTo(0, 0);
  const target = app().querySelector('[data-focus]');
  if (target) target.focus({ preventScroll: true });
}

function nextFrom(pageId) {
  if (!validatePage()) return;
  const { pages, index } = pageIndex(pageId);
  if (index === -1) return pages[0] ? go('page', pages[0].id) : go('review');
  return pages[index + 1] ? go('page', pages[index + 1].id) : go('review');
}

function prevFrom(pageId) {
  const { pages, index } = pageIndex(pageId);
  if (index > 0) go('page', pages[index - 1].id);
  else go('intro');
}

function pageOf(qid) {
  return PAGES.find((p) => p.ids.includes(qid));
}

// ------------------------------------------------------------ answers
function setAnswer(id, value) {
  if (value === undefined || value === null || (Array.isArray(value) && !value.length)) delete state.answers[id];
  else state.answers[id] = value;
  // hidden questions/options lose their answers; Z01 stays raw while typing
  const raw = state.answers.Z01;
  state.answers = normalize(survey, state.answers);
  if (raw !== undefined && raw !== '') state.answers.Z01 = raw;
  if (state.pending) state.pending = null; // answers changed: a new payload will be built
  syncPage();
  if (id === 'Z01') saveDraftSoon(); else saveDraft();
}

function toggleMultiple(q, code, checked) {
  const cur = new Set(state.answers[q.id] || []);
  const exclusive = q.exclusive_codes.includes(code);
  if (checked) {
    if (exclusive) { cur.clear(); cur.add(code); } else {
      q.exclusive_codes.forEach((c) => cur.delete(c));
      if (cur.size >= q.maximum_selections) { syncPage(); return; }
      cur.add(code);
    }
  } else cur.delete(code);
  setAnswer(q.id, q.options.map((o) => o.code).filter((c) => cur.has(c)));
}

// ------------------------------------------------------------ rendering
function render() {
  const root = app();
  root.replaceChildren();
  root.append(header());
  if (hasPlaceholders() && state.phase !== 'done') root.append(h('p', { class: 'banner', role: 'note', 'data-chrome': '', text: T.placeholderBanner }));
  if (state.phase === 'intro') renderIntro(root);
  else if (state.phase === 'page') renderPage(root);
  else if (state.phase === 'review') renderReview(root);
  else renderDone(root);
}

function header() {
  return h('header', { class: 'site-head' }, h('h1', { 'data-v': 'title', text: content.title }));
}

function researcherLine(text) {
  const keys = { 'پژوهشگر': 'RESEARCHER', 'دانشگاه': 'UNIVERSITY', 'استاد راهنما': 'SUPERVISOR', 'تماس پژوهشی': 'CONTACT' };
  const p = h('p', { 'data-v': 'para' });
  text.split(' | ').forEach((seg) => {
    const [label] = seg.split(':');
    const value = CONFIG[keys[label.trim()]] ?? seg.slice(label.length + 1).trim();
    if (!value?.trim() || value === PLACEHOLDER) return;
    if (p.childNodes.length) p.append(' | ');
    p.append(`${label.trim()}: `);
    p.append(value);
  });
  return p.childNodes.length ? p : null;
}

function renderIntro(root) {
  const draft = store.get();
  const resumable = draft && draft.v === survey.version && (draft.phase === 'page' || draft.phase === 'review');
  if (resumable) {
    root.append(h('div', { class: 'card', role: 'region', 'aria-label': T.resumeText },
      h('p', { 'data-chrome': '', text: T.resumeText }),
      h('div', { class: 'nav' },
        h('button', { type: 'button', class: 'btn', 'data-chrome': '', text: T.restart, onclick: () => { store.clear(); resetState(); render(); } }),
        h('button', { type: 'button', class: 'btn primary', 'data-chrome': '', text: T.resume, onclick: () => resume(draft) }))));
  }
  const card = h('section', { class: 'card' });
  card.append(h('h2', { class: 'intro-heading', 'data-v': 'intro-heading', 'data-focus': '', tabindex: '-1', text: content.intro.heading }));
  if (CONFIG.TEST_NOTICE) card.append(h('p', { class: 'test-notice', 'data-chrome': '', text: CONFIG.TEST_NOTICE }));
  if (CONFIG.TEST_NOTICE && CONFIG.TEST_NOTICE_DETAIL) card.append(h('p', { 'data-chrome': '', text: CONFIG.TEST_NOTICE_DETAIL }));
  for (const [i, para] of content.intro.paragraphs.entries()) {
    if (CONFIG.TEST_NOTICE && (i < 2 || para.kind === 'retention')) continue;
    if (para.kind === 'researcher') { if (CONFIG.SHOW_RESEARCHER) card.append(researcherLine(para.text)); }
    else {
      const text = para.kind === 'retention' && CONFIG.RETENTION_TEXT ? CONFIG.RETENTION_TEXT
        : i < 2 && CONFIG.INTRO_TEXT?.[i] ? CONFIG.INTRO_TEXT[i] : para.text;
      card.append(h('p', { 'data-v': 'para', text }));
    }
  }
  const err = h('p', { class: 'msg error', role: 'alert', id: 'entry-error', 'data-chrome': '' });
  survey.entry_controls.forEach((c, i) => {
    const e = content.intro.entry[i];
    const input = h('input', { type: 'checkbox', name: c.id, checked: state.conf[c.id], 'aria-required': 'true',
      onchange: (ev) => { state.conf[c.id] = ev.target.checked; err.textContent = ''; } });
    card.append(h('fieldset', { class: 'q', 'data-entry': c.id },
      h('legend', { 'data-v': 'entry-legend', text: e.legend }),
      h('label', { class: 'opt' }, input, h('span', { class: 'opt-text', 'data-v': 'entry', text: c.text }))));
  });
  card.append(err);
  card.append(h('div', { class: 'nav' },
    h('span'),
    h('button', { type: 'button', class: 'btn primary', 'data-v': 'start', text: content.intro.start, onclick: startForm })));
  root.append(card);
}

function resetState() {
  Object.assign(state, { phase: 'intro', pageId: 'p1', answers: {}, conf: { G01: false, G02: false }, startedAt: null, responseId: null, channel: '', pending: null });
}

function startForm() {
  if (!state.conf.G01 || !state.conf.G02) {
    document.getElementById('entry-error').textContent = T.needConfirm;
    const first = document.querySelector(`[data-entry="${state.conf.G01 ? 'G02' : 'G01'}"] input`);
    if (first) first.focus();
    return;
  }
  state.startedAt = isoNow();
  state.responseId = uuid();
  state.channel = channelFromUrl();
  go('page', 'p1');
}

function resume(draft) {
  Object.assign(state, {
    phase: draft.phase, pageId: draft.pageId, answers: draft.answers || {}, conf: draft.conf || { G01: true, G02: true },
    startedAt: draft.startedAt, responseId: draft.responseId, channel: channelFromUrl() || draft.channel || '', pending: draft.pending || null,
  });
  state.answers = (() => { const z = state.answers.Z01; const n = normalize(survey, state.answers); if (z) n.Z01 = z; return n; })();
  go(state.phase, state.pageId);
}

// ---- question pages
let live = { blocks: [], sections: [], progress: null };

function setQuestionError(block, invalid) {
  block.error.textContent = invalid ? (block.q.type === 'multiple' ? T.requiredMultiple : T.required) : '';
  for (const el of [block.el, ...block.inputs]) {
    if (invalid) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  }
}

function validatePage() {
  const missing = new Set(missingRequiredIds(survey, state.answers, live.blocks.map((b) => b.q.id)));
  for (const block of live.blocks) setQuestionError(block, missing.has(block.q.id));
  const first = live.blocks.find((b) => missing.has(b.q.id));
  if (first) first.inputs.find((input, i) => !input.disabled && !first.labels[i]?.hidden)?.focus();
  return !first;
}

function questionBlock(q) {
  const m = content.questions[q.id];
  const noteId = `${q.id}-note`;
  const statusId = `${q.id}-status`;
  const fs = h('fieldset', { class: 'q', 'data-q': q.id });
  const legend = h('legend', { 'data-v': 'question', 'data-id': q.id, text: q.text });
  fs.append(legend);
  const describedBy = [];
  if (m.note) { fs.append(h('p', { class: 'q-note', id: noteId, 'data-v': 'note', text: m.note })); describedBy.push(noteId); }
  const block = { q, el: fs, inputs: [], labels: [], opts: [], status: null, clear: null };
  block.error = h('p', { class: 'msg error', id: `${q.id}-error`, role: 'alert', 'data-chrome': '' });
  describedBy.push(block.error.id);
  fs.setAttribute('aria-describedby', describedBy.join(' '));
  if (q.id !== 'Z01') fs.setAttribute('aria-required', 'true');

  if (q.type === 'text') {
    const id = `${q.id}-field`;
    fs.append(h('label', { class: 'field-label', for: id, 'data-v': 'field-label', text: m.fieldLabel }));
    const ta = h('textarea', { class: 'free', id, name: q.id, maxlength: '1000', rows: '4', autocomplete: 'off',
      oninput: (ev) => setAnswer(q.id, ev.target.value) });
    if (describedBy.length) ta.setAttribute('aria-describedby', describedBy.join(' '));
    block.inputs.push(ta);
    fs.append(ta);
    fs.append(block.error);
    return block;
  }

  const multiple = q.type === 'multiple';
  const list = h('div', { class: 'opts' });
  // Options are laid out in this respondent's order (JSON order for non-randomized questions).
  // The order is a pure function of the response_id, so back/forward, reload and draft restore show the same layout.
  const byCode = Object.fromEntries(q.options.map((o) => [o.code, o]));
  for (const code of optionOrder(survey, q.id, state.responseId)) {
    const o = byCode[code];
    block.opts.push(o);
    const input = h('input', { type: multiple ? 'checkbox' : 'radio', name: q.id, value: String(o.code), 'data-code': String(o.code),
      onchange: (ev) => (multiple ? toggleMultiple(q, o.code, ev.target.checked) : setAnswer(q.id, o.code)) });
    const label = h('label', { class: 'opt', 'data-code': String(o.code) }, input, h('span', { class: 'opt-text', 'data-v': 'option', text: o.label }));
    block.inputs.push(input);
    block.labels.push(label);
    list.append(label);
  }
  fs.append(list);
  if (multiple) {
    block.status = h('p', { class: 'q-status', id: statusId, 'aria-live': 'polite', 'data-chrome': '' });
    fs.append(block.status);
    describedBy.push(statusId);
  } else {
    block.clear = h('button', { type: 'button', class: 'btn link', 'data-chrome': '', text: T.clear, onclick: () => setAnswer(q.id, undefined) });
    fs.append(block.clear);
  }
  if (describedBy.length) fs.setAttribute('aria-describedby', describedBy.join(' '));
  for (const input of block.inputs) input.setAttribute('aria-describedby', describedBy.join(' '));
  fs.append(block.error);
  return block;
}

function renderPage(root) {
  const page = PAGES.find((p) => p.id === state.pageId) || PAGES[0];
  live = { blocks: [], sections: [], progress: null };

  const progress = h('div', { class: 'progress' },
    h('p', { class: 'progress-label', id: 'progress-label', 'data-chrome': '' }),
    h('div', { class: 'progress-track', role: 'progressbar', 'aria-labelledby': 'progress-label', 'aria-valuemin': '0', 'aria-valuemax': '100' },
      h('div', { class: 'progress-fill' })));
  live.progress = progress;
  root.append(progress);

  const card = h('section', { class: 'card' });
  // group the page's questions by questionnaire section
  const groups = [];
  for (const id of page.ids) {
    const sIdx = content.questions[id].section;
    let g = groups[groups.length - 1];
    if (!g || g.sIdx !== sIdx) { g = { sIdx, ids: [] }; groups.push(g); }
    g.ids.push(id);
  }
  let first = true;
  for (const g of groups) {
    const sec = content.sections[g.sIdx];
    const wrap = h('div', { class: 'sec' });
    const title = h('h2', { class: 'sec-title', 'data-v': 'section-title', text: sec.title });
    if (first) { title.setAttribute('data-focus', ''); title.setAttribute('tabindex', '-1'); first = false; }
    wrap.append(title);
    if (sec.intro) wrap.append(h('p', { class: 'sec-intro', 'data-v': 'section-intro', text: sec.intro }));
    if (page.definition && g.ids[0] === 'A02') {
      wrap.append(h('aside', { class: 'definition' },
        h('h3', { 'data-v': 'definition-title', text: content.definition.title }),
        h('p', { 'data-v': 'definition-body', text: content.definition.body })));
    }
    for (const id of g.ids) {
      const block = questionBlock(qById[id]);
      block.sec = wrap;
      live.blocks.push(block);
      wrap.append(block.el);
    }
    live.sections.push({ el: wrap, blocks: live.blocks.filter((b) => b.sec === wrap) });
    card.append(wrap);
  }
  card.append(h('div', { class: 'nav' },
    h('button', { type: 'button', class: 'btn', 'data-chrome': '', text: T.back, onclick: () => prevFrom(page.id) }),
    h('button', { type: 'button', class: 'btn primary', 'data-chrome': '', text: T.next, onclick: () => nextFrom(page.id) })));
  root.append(card);
  syncPage();
}

/** Push state into the current page's DOM: visibility, checked, disabled, hints, progress. */
function syncPage() {
  if (state.phase !== 'page') return;
  const a = state.answers;
  for (const b of live.blocks) {
    const q = b.q;
    b.el.hidden = !isShown(survey, q.id, a);
    if (b.el.hidden || !missingRequiredIds(survey, a, [q.id]).length) setQuestionError(b, false);
    if (q.type === 'text') {
      if (document.activeElement !== b.inputs[0]) b.inputs[0].value = a[q.id] ?? '';
      continue;
    }
    const cur = q.type === 'multiple' ? (a[q.id] || []) : a[q.id] === undefined ? [] : [a[q.id]];
    const vis = new Set(visibleCodes(survey, q.id, a));
    const atMax = q.type === 'multiple' && cur.length >= q.maximum_selections;
    b.opts.forEach((o, i) => {
      const input = b.inputs[i];
      input.checked = cur.includes(o.code);
      b.labels[i].hidden = !vis.has(o.code);
      input.disabled = atMax && !input.checked && !q.exclusive_codes.includes(o.code);
    });
    if (b.status) b.status.textContent = atMax ? T.maxReached(q.maximum_selections) : '';
    if (b.clear) b.clear.hidden = cur.length === 0;
  }
  for (const s of live.sections) s.el.hidden = s.blocks.every((b) => b.el.hidden);
  const { pages, index } = pageIndex(state.pageId);
  const pos = index === -1 ? 1 : index + 1;
  live.progress.querySelector('.progress-label').textContent = T.progress(pos, pages.length);
  const track = live.progress.querySelector('.progress-track');
  const pct = Math.round((pos / pages.length) * 100);
  track.setAttribute('aria-valuenow', String(pct));
  live.progress.querySelector('.progress-fill').style.inlineSize = `${pct}%`;
}

// ---- review + submit
function answerLabels(q) {
  const v = state.answers[q.id];
  if (v === undefined) return null;
  if (q.type === 'text') return v.trim() || null;
  const codes = Array.isArray(v) ? v : [v];
  return q.options.filter((o) => codes.includes(o.code)).map((o) => o.label).join('، ');
}

function renderReview(root) {
  const card = h('section', { class: 'card review' });
  card.append(h('h2', { 'data-chrome': '', 'data-focus': '', tabindex: '-1', text: T.reviewHeading }));
  card.append(h('p', { 'data-chrome': '', text: T.reviewHint }));
  const list = h('ul', { class: 'review-list' });
  for (const q of survey.questions) {
    if (!isShown(survey, q.id, state.answers)) continue;
    const ans = answerLabels(q);
    list.append(h('li', {},
      h('p', { class: 'review-q', text: q.text }),
      h('p', { class: `review-a${ans ? '' : ' none'}`, 'data-chrome': '', text: ans ?? T.noAnswer }),
      h('button', { type: 'button', class: 'btn link small', 'data-chrome': '', text: T.edit, onclick: () => go('page', pageOf(q.id).id) })));
  }
  card.append(list);

  const msg = h('p', { class: 'msg error', id: 'submit-error', role: 'alert', 'data-chrome': '' });
  const hp = h('div', { class: 'hp', 'aria-hidden': 'true', inert: '' },
    h('label', {}, 'website', h('input', { type: 'text', name: 'website', id: 'website', tabindex: '-1', autocomplete: 'off' })));
  const submit = h('button', { type: 'button', class: 'btn primary', id: 'submit', 'data-chrome': '', text: state.pending ? T.retry : T.submit });
  submit.addEventListener('click', () => submitForm(submit, msg));
  card.append(hp, msg, h('div', { class: 'nav' },
    h('button', { type: 'button', class: 'btn', 'data-chrome': '', text: T.back, onclick: () => {
      const { pages } = pageIndex(state.pageId);
      go('page', pages[pages.length - 1].id);
    } }),
    submit));
  root.append(card);
  if (state.pending) { msg.className = 'msg error'; msg.textContent = T.netError; }
}

function buildPayload() {
  const answers = normalize(survey, state.answers);
  return {
    response_id: state.responseId,
    form_version: survey.version,
    started_at: state.startedAt,
    channel: state.channel,
    confirmations: { G01: true, G02: true },
    answers,
    // the option order each randomized question was laid out in (only questions shown to this respondent)
    option_order: shownOptionOrders(survey, answers, state.responseId),
    website: document.getElementById('website')?.value ?? '',
  };
}

let sending = false;
async function submitForm(button, msg) {
  if (sending) return;
  const missing = missingRequiredIds(survey, normalize(survey, state.answers));
  if (missing.length) {
    state.pending = null;
    go('page', pageOf(missing[0]).id);
    validatePage();
    return;
  }
  // A pending payload from an older draft may predate the required-answer rule.
  if (state.pending && missingRequiredIds(survey, state.pending.answers || {}).length) state.pending = null;
  const base = apiBase();
  if (!base) { msg.className = 'msg error'; msg.textContent = T.noApi; return; }
  sending = true;
  button.setAttribute('aria-disabled', 'true');
  button.textContent = T.sending;
  msg.textContent = '';
  const payload = state.pending || buildPayload();
  state.pending = payload;
  saveDraft();
  const fail = (text) => {
    msg.className = 'msg error';
    msg.textContent = text;
    button.removeAttribute('aria-disabled');
    button.textContent = T.retry;
    sending = false;
  };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SUBMIT_TIMEOUT_MS);
  try {
    // text/plain keeps this a "simple" CORS request (no preflight round trip on flaky networks)
    const res = await fetch(`${base}/api/responses`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), signal: ctl.signal,
    });
    clearTimeout(timer);
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    if (res.ok && body && body.ok === true) {
      store.clear();
      state.pending = null;
      sending = false;
      state.phase = 'done';
      render();
      window.scrollTo(0, 0);
      const target = app().querySelector('[data-focus]');
      if (target) target.focus({ preventScroll: true });
      return;
    }
    if (res.status >= 500 || !body) { fail(T.netError); return; }
    // 4xx: the server answered and refused; the same payload would be refused again
    state.pending = null;
    saveDraft();
    if (body.error === 'too_fast') fail(T.tooFast);
    else if (body.error === 'invalid') fail(T.invalid);
    else fail(T.rejected);
  } catch {
    clearTimeout(timer);
    fail(T.netError);
  }
}

function renderDone(root) {
  root.append(h('section', { class: 'card thanks' },
    h('h2', { 'data-chrome': '', 'data-focus': '', tabindex: '-1', text: T.thanksDone }),
    h('p', { 'data-v': 'thanks', text: content.thanks })));
}

// ------------------------------------------------------------ boot
async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function boot() {
  try {
    [survey, content] = await Promise.all([loadJson('assets/survey.json'), loadJson('assets/content.json')]);
  } catch {
    app().replaceChildren(h('p', { class: 'boot', 'data-chrome': '', text: T.loadFail }));
    return;
  }
  for (const q of survey.questions) qById[q.id] = q;
  if (new URLSearchParams(location.search).get('ids') === '1') document.body.classList.add('show-ids');
  render();
}

// test hook for scripts (routing/screenshot runs); harmless in production
window.__survey = { state, roleOf: () => roleOf(survey, state.answers) };

boot();

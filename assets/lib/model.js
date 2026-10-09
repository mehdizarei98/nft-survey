// Shared survey logic. Plain ES module: loaded by the page, imported by the Worker
// (bundled by wrangler) and by the Node scripts. Nothing here touches the DOM or Node APIs.
//
// Source of truth: assets/survey.json (copy of input/survey_codes_v4_3.json) and
// input/SURVEY-DATA-SCHEMA.md. Answers are plain objects:
//   { A01: 3, A02: [1, 2], Z01: "text" }   (missing key = not answered)

export const CHANNELS = ['uni', 'art', 'crypto', 'social', 'other'];
export const MAX_TEXT = 1000;

// question id -> key of survey.routing that makes it visible (guide §4/§5).
// Questions not listed are always shown.
const ROUTE_OF = {
  E01: 'experience', E02: 'experience', E03: 'experience',
  E04: 'access_followup',
  N01: 'no_recent_experience',
  B01: 'buyer', B02: 'buyer',
  C01: 'seller', C02: 'seller',
};

/** Evaluate a routing expression of the JSON, e.g. "A03 in [2,3] and E02 contains 8". */
export function evalRule(rule, answers) {
  return rule.split(/\s+and\s+/).every((part) => {
    let m = part.match(/^([A-Z]\d{2}) in \[([\d,\s]+)\]$/);
    if (m) {
      const set = m[2].split(',').map((s) => Number(s.trim()));
      const v = answers[m[1]];
      return typeof v === 'number' && set.includes(v);
    }
    m = part.match(/^([A-Z]\d{2}) contains (\d+)$/);
    if (m) {
      const v = answers[m[1]];
      return Array.isArray(v) && v.includes(Number(m[2]));
    }
    throw new Error(`Unsupported routing expression: ${part}`);
  });
}

export function questionById(survey) {
  return Object.fromEntries(survey.questions.map((q) => [q.id, q]));
}

/** Is question `id` shown, given the answers of earlier questions? */
export function isShown(survey, id, answers) {
  const key = ROUTE_OF[id];
  return key ? evalRule(survey.routing[key], answers) : true;
}

export function roleOf(survey, answers) {
  const buyer = evalRule(survey.routing.buyer, answers);
  const seller = evalRule(survey.routing.seller, answers);
  return buyer && seller ? 'both' : buyer ? 'buyer' : seller ? 'seller' : 'other';
}

export function branchOf(survey, answers) {
  if (evalRule(survey.routing.experience, answers)) return 'experience';
  if (evalRule(survey.routing.no_recent_experience, answers)) return 'no_recent';
  return 'none';
}

/** Option codes of `id` that are visible for these answers (only P01 has hidden options). */
export function visibleCodes(survey, id, answers) {
  const q = questionById(survey)[id];
  const codes = q.options.map((o) => o.code);
  if (id !== 'P01') return codes;
  const available = new Set(survey.routing.P01_available);
  return codes.filter((c) => {
    if (available.has(c)) return true;
    const need = survey.routing.P01_conditional[String(c)];
    return need ? evalRule(survey.routing[need], answers) : false;
  });
}

/**
 * Drop answers of hidden questions and hidden options (a changed earlier answer can hide
 * later ones). Walks questions in order so E04 sees the cleaned E02. Returns a new object.
 */
export function normalize(survey, answers) {
  const out = {};
  for (const q of survey.questions) {
    const v = answers[q.id];
    if (v === undefined || v === null) continue;
    if (!isShown(survey, q.id, out)) continue;
    if (q.type === 'multiple') {
      const vis = new Set(visibleCodes(survey, q.id, out));
      const kept = v.filter((c) => vis.has(c));
      if (kept.length) out[q.id] = kept;
    } else if (q.type === 'text') {
      const t = cleanText(v);
      if (t) out[q.id] = t;
    } else {
      out[q.id] = v;
    }
  }
  return out;
}

export function cleanText(v) {
  return String(v).replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, MAX_TEXT).trim();
}

export function p01Variant(survey, answers) {
  return roleOf(survey, answers);
}

export function stateOf(survey, q, answers) {
  if (!isShown(survey, q.id, answers)) return 'not_shown';
  const v = answers[q.id];
  const answered = q.type === 'multiple' ? Array.isArray(v) && v.length > 0
    : q.type === 'text' ? typeof v === 'string' && v.trim() !== ''
      : v !== undefined && v !== null;
  return answered ? 'answered' : 'shown_no_answer';
}

// ---------------------------------------------------------------- columns / CSV

export const META_COLUMNS = [
  'response_id', 'source', 'persona_id', 'generator', 'form_version', 'lang',
  'started_at', 'submitted_at', 'duration_sec', 'channel', 'G01', 'G02',
  'role', 'experience_branch',
];

/**
 * Column order per question (SURVEY-DATA-SCHEMA.md): Q__state first, then
 *   single -> Q ; multiple -> Q_<code>... then Q__visible ; text -> Q ;
 * P01 additionally ends with P01_variant.
 */
export function buildColumns(survey) {
  const cols = [...META_COLUMNS];
  for (const q of survey.questions) {
    cols.push(`${q.id}__state`);
    if (q.type === 'multiple') {
      for (const o of q.options) cols.push(`${q.id}_${o.code}`);
      cols.push(`${q.id}__visible`);
      if (q.id === 'P01') cols.push('P01_variant');
    } else {
      cols.push(q.id);
    }
  }
  return cols;
}

/**
 * One CSV row (object keyed by column) for a validated submission.
 * meta: { response_id, source, persona_id, generator, started_at, submitted_at, duration_sec, channel }
 */
export function buildRow(survey, meta, rawAnswers) {
  const answers = normalize(survey, rawAnswers);
  const row = {
    response_id: meta.response_id,
    source: meta.source,
    persona_id: meta.persona_id ?? '',
    generator: meta.generator,
    form_version: survey.version,
    lang: 'fa',
    started_at: meta.started_at,
    submitted_at: meta.submitted_at,
    duration_sec: String(meta.duration_sec),
    channel: meta.channel ?? '',
    G01: '1',
    G02: '1',
    role: roleOf(survey, answers),
    experience_branch: branchOf(survey, answers),
  };
  for (const q of survey.questions) {
    const state = stateOf(survey, q, answers);
    row[`${q.id}__state`] = state;
    const v = answers[q.id];
    if (q.type === 'multiple') {
      const shown = state !== 'not_shown';
      const vis = shown ? visibleCodes(survey, q.id, answers) : [];
      for (const o of q.options) {
        row[`${q.id}_${o.code}`] = state === 'answered' && vis.includes(o.code)
          ? (v.includes(o.code) ? '1' : '0') : '';
      }
      row[`${q.id}__visible`] = vis.join(';');
      if (q.id === 'P01') row.P01_variant = p01Variant(survey, answers);
    } else if (q.type === 'text') {
      row[q.id] = state === 'answered' ? cleanText(v) : '';
    } else {
      row[q.id] = state === 'answered' ? String(v) : '';
    }
  }
  return row;
}

/** RFC 4180 field. Z01-style text that Excel would read as a formula gets a leading apostrophe. */
export function csvField(value, { neutralizeFormula = false } = {}) {
  let s = String(value ?? '');
  if (neutralizeFormula && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(columns, row, textColumns = new Set()) {
  return columns.map((c) => csvField(row[c], { neutralizeFormula: textColumns.has(c) })).join(',');
}

export function textColumnsOf(survey) {
  return new Set(survey.questions.filter((q) => q.type === 'text').map((q) => q.id));
}

/** Full CSV text: UTF-8 BOM, CRLF line endings, trailing CRLF. */
export function toCsv(survey, rows) {
  const cols = buildColumns(survey);
  const text = textColumnsOf(survey);
  const lines = [cols.join(','), ...rows.map((r) => csvLine(cols, r, text))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Minimal RFC 4180 parser (handles quoted fields, embedded commas/newlines, BOM). */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------- validation

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const ALLOWED_KEYS = new Set(['response_id', 'form_version', 'started_at', 'channel', 'confirmations', 'answers', 'website']);

/** Validate one answer value against its question. Returns an error string or null. */
export function checkAnswer(q, v) {
  if (q.type === 'single') {
    if (!Number.isInteger(v) || !q.options.some((o) => o.code === v)) return 'invalid code';
  } else if (q.type === 'multiple') {
    if (!Array.isArray(v) || v.length === 0) return 'expected non-empty array';
    if (!v.every((c) => Number.isInteger(c) && q.options.some((o) => o.code === c))) return 'invalid code';
    if (new Set(v).size !== v.length) return 'duplicate code';
    if (v.length > q.maximum_selections) return `more than ${q.maximum_selections} selections`;
    if (v.length > 1 && v.some((c) => q.exclusive_codes.includes(c))) return 'exclusive code combined with others';
  } else if (q.type === 'text') {
    if (typeof v !== 'string' || v.length > 4 * MAX_TEXT) return 'invalid text';
  }
  return null;
}

/**
 * Validate a submission payload (the JSON the form POSTs). Pure; time checks are done by the caller
 * because they need the clock. Returns { ok, errors, honeypot, answers, channel } .
 */
export function validateSubmission(survey, payload) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload must be an object'], honeypot: false };
  }
  for (const k of Object.keys(payload)) {
    if (!ALLOWED_KEYS.has(k)) fail(`unknown field: ${k}`);
  }
  const honeypot = typeof payload.website === 'string' && payload.website.trim() !== '';
  if (payload.form_version !== survey.version) fail('form_version mismatch');
  if (!UUID_V4.test(String(payload.response_id ?? ''))) fail('response_id must be a UUID v4');
  if (!ISO_SECONDS.test(String(payload.started_at ?? '')) || Number.isNaN(Date.parse(payload.started_at))) {
    fail('started_at must be ISO 8601 UTC (YYYY-MM-DDTHH:MM:SSZ)');
  }
  const conf = payload.confirmations;
  if (!conf || conf.G01 !== true || conf.G02 !== true) fail('G01 and G02 must be confirmed');
  const channel = payload.channel ?? '';
  if (channel !== '' && !CHANNELS.includes(channel)) fail('invalid channel');

  const answers = payload.answers;
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) {
    fail('answers must be an object');
    return { ok: false, errors, honeypot };
  }
  const byId = questionById(survey);
  for (const id of Object.keys(answers)) {
    if (!byId[id]) fail(`unknown question: ${id}`);
  }
  // Walk in order so each question is judged against the earlier answers it depends on.
  const seen = {};
  for (const q of survey.questions) {
    const v = answers[q.id];
    if (v === undefined) continue;
    const err = checkAnswer(q, v);
    if (err) { fail(`${q.id}: ${err}`); continue; }
    if (!isShown(survey, q.id, seen)) { fail(`${q.id}: answered but hidden by routing`); continue; }
    if (q.id === 'P01') {
      const vis = new Set(visibleCodes(survey, 'P01', seen));
      if (v.some((c) => !vis.has(c))) { fail('P01: option hidden for this role'); continue; }
    }
    seen[q.id] = v;
  }
  return { ok: errors.length === 0, errors, honeypot, channel, answers: errors.length ? undefined : normalize(survey, answers) };
}

#!/usr/bin/env node
/**
 * Ask the local model (Ollama, default gemma4:12b) a small question. Free and offline, so it is
 * the first choice for small, well-bounded jobs: spotting duplicates in a list, summarising a
 * file, drafting test names or kid-level wording, classifying items, checking a short text.
 * Not for: changing engine code unreviewed, long multi-file reasoning (use Codex for review, the
 * main agent for integration). Its answer is a draft: check it before using it.
 *
 *   node tools/local-llm/ask.mjs --prompt "..." [--files a.md,b.js] [--out answer.md]
 *   node tools/local-llm/ask.mjs --prompt-file task.md --files docs/ERRORS.md --json
 *   node tools/local-llm/ask.mjs check
 *
 * Options: --model NAME  --ctx TOKENS (default 16384)  --temp N (default 0.2)  --timeout SEC
 * Environment: LOCAL_LLM_URL (default http://127.0.0.1:11434), LOCAL_LLM_MODEL.
 * Exit codes: 0 ok, 3 server not reachable or model missing, 4 bad usage.
 */
import fs from 'node:fs';
import path from 'node:path';

const URL_BASE = process.env.LOCAL_LLM_URL || 'http://127.0.0.1:11434';
const argv = process.argv.slice(2);
const opt = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const model = opt('model', process.env.LOCAL_LLM_MODEL || 'gemma4:12b');

async function models() {
  const r = await fetch(`${URL_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
  return (await r.json()).models.map((m) => m.name);
}

async function main() {
  let names;
  try {
    names = await models();
  } catch {
    console.error(`local-llm: no answer from ${URL_BASE}. Start Ollama, or set LOCAL_LLM_URL.`);
    return 3;
  }
  if (argv[0] === 'check') {
    console.log(`server : ${URL_BASE}\nmodels : ${names.join(', ') || '(none)'}\nresult : ${names.includes(model) ? `OK, ${model} is ready` : `model ${model} is not installed`}`);
    return names.includes(model) ? 0 : 3;
  }
  if (!names.includes(model)) {
    console.error(`local-llm: model ${model} is not installed (have: ${names.join(', ')}).`);
    return 3;
  }
  let prompt = opt('prompt', '');
  if (opt('prompt-file')) prompt = fs.readFileSync(path.resolve(opt('prompt-file')), 'utf8');
  if (!prompt.trim()) {
    console.error('local-llm: give --prompt "..." or --prompt-file FILE');
    return 4;
  }
  const ctx = Number(opt('ctx', 16384));
  const files = (opt('files', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
  let text = prompt.trim();
  for (const f of files) text += `\n\n===== FILE: ${f} =====\n${fs.readFileSync(path.resolve(f), 'utf8')}`;
  const roughTokens = Math.ceil(text.length / 3.5);
  if (roughTokens > ctx * 0.8) console.error(`local-llm: WARNING about ${roughTokens} tokens of input for a ${ctx}-token window; the start may be cut off. Send less, or raise --ctx.`);

  const started = Date.now();
  const res = await fetch(`${URL_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(Number(opt('timeout', 600)) * 1000),
    body: JSON.stringify({
      model,
      stream: true, // headers arrive at once; without streaming a slow answer hits Node's 5-minute header timeout
      format: argv.includes('--json') ? 'json' : undefined,
      options: { num_ctx: ctx, temperature: Number(opt('temp', 0.2)) },
      messages: [
        { role: 'system', content: 'You are a careful assistant on a software project. Answer only from the text you are given. Be brief and concrete. If you are not sure, say so instead of guessing.' },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`local-llm: server answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return 3;
  }
  // Ollama streams one JSON object per line; the last one carries the token counts.
  let answer = '';
  let data = {};
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const part = JSON.parse(line);
      answer += part.message?.content ?? '';
      if (part.done) data = part;
    }
  }
  if (opt('out')) fs.writeFileSync(path.resolve(opt('out')), answer);
  console.log(answer.trim());
  console.error(`\nlocal-llm: ${model}, ${((Date.now() - started) / 1000).toFixed(0)} s, in ${data.prompt_eval_count ?? '?'} / out ${data.eval_count ?? '?'} tokens${opt('out') ? `, saved to ${opt('out')}` : ''}`);
  return 0;
}

process.exitCode = await main().catch((e) => {
  console.error(`local-llm: ${e.name === 'TimeoutError' ? 'timed out (raise --timeout or send less text)' : e.message}`);
  return 3;
});

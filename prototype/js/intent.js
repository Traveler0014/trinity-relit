// 模型只选择本次候选；标准命令、状态检查与执行都留在本地。
const first = value => Array.isArray(value) ? value[0] : value;
export const INTENT_INPUT_LIMIT = 300;

export function matchingEvent(engine, command) {
  return (engine.currentRoom()?.events || []).find(event => event.match &&
    (!event.when || event.when(engine.state)) && engine._matchCommand(command, event.match));
}

// known 表示引擎已有确定响应，包括拿不到物品、出口被挡等失败响应。
export function commandIsKnown(engine, command) {
  if (!command) return false;
  if (command.type === 'direction' || command.type === 'meta') return true;
  if (matchingEvent(engine, command)) return true;
  if ((engine.currentRoom()?.events || []).some(event => event.match && engine._matchCommand(command, event.match))) return true;
  if (!command.noun) return true;
  if (engine._resolveItem(command.noun)) return true;
  return false;
}

export function needsClarification(input) {
  // 明确否定、假设、询问结果和并列动作不能作为单个执行请求。
  return /(?:不要|别|不想|不拿|不扔|不打开|不需要|如果|假如|会怎样|会发生|还是|或者|然后|接着|[?？]|\b(?:don't|do not|never|if|what happens|or|then)\b)/i.test(input);
}

export function buildIntentCandidates(engine) {
  const candidates = [];
  const add = (id, command, examples) => {
    examples = [...new Set(examples.filter(x => typeof x === 'string' && x.trim()))];
    if (!examples.length) return;
    const label = examples.find(x => /[\u3400-\u9fff]/.test(x)) || examples[0];
    candidates.push({ id, command, examples, label });
  };
  for (const event of engine.currentRoom()?.events || []) {
    if (!event.match || (event.when && !event.when(engine.state))) continue;
    const m = event.match;
    const command = (event.triggers || []).map(t => engine.parser.parse(t)).find(c =>
      c && ['simple', 'compound'].includes(c.type) && matchingEvent(engine, c) === event) || {
      type: m.noun2 ? 'compound' : 'simple', verb: first(m.verb), noun: first(m.noun) || null,
      ...(m.noun2 ? { prep: 'with', noun2: first(m.noun2) } : {}),
    };
    if (!command.verb || matchingEvent(engine, command) !== event) continue;
    add(`event:${event.id}`, command, [...(event.triggers || []),
      [command.verb, command.noun, command.noun2].filter(Boolean).join(' ')]);
  }
  const ids = new Set([...engine.state.roomItems(), ...engine.state.inventoryList().map(x => x.id)]);
  for (const id of ids) {
    const item = engine.items[id];
    if (!item) continue;
    for (const [verb, cn] of [['examine', '查看'], ['take', '拿起'], ['drop', '放下']]) {
      if (verb === 'drop' && !engine.state.has(id)) continue;
      if (verb === 'take' && engine.state.has(id) && !engine.state.inPocket(id)) continue;
      const command = { type: 'simple', verb, noun: id };
      if (matchingEvent(engine, command)) continue;
      add(`item:${verb}:${id}`, command, [`${cn}${item.cn || id}`, `${verb} ${item.name || id.replaceAll('_', ' ')}`]);
    }
  }
  const exits = engine.currentRoom()?.exits;
  const directions = typeof exits === 'function' ? exits(engine.state) : exits;
  const names = { n:'北', ne:'东北', e:'东', se:'东南', s:'南', sw:'西南', w:'西', nw:'西北', u:'上', d:'下', in:'里', out:'外' };
  const english = { n:'north', ne:'northeast', e:'east', se:'southeast', s:'south', sw:'southwest', w:'west', nw:'northwest', u:'up', d:'down', in:'inside', out:'outside' };
  for (const dir of Object.keys(directions || {})) {
    if (names[dir]) add(`direction:${dir}`, { type:'direction', dir }, [`往${names[dir]}走`, `go ${english[dir]}`]);
  }
  return candidates;
}

export function intentStateStamp(engine) {
  // 比较用，不把存档发给模型；deserialize 换对象时还会额外检查引用。
  return JSON.stringify(engine.serialize().state);
}

// 缺少宾语的明确动词，只列出同动词的当前事件，不需要模型猜测。
export function completeCommand(engine, command) {
  if (!command || command.noun || !command.verb || matchingEvent(engine, command)) return null;
  const candidates = buildIntentCandidates(engine).filter(candidate =>
    candidate.id.startsWith('event:') && candidate.command.verb === command.verb);
  return candidates.length && candidates.length <= 3 ? confirmedCandidates(engine, candidates) : null;
}

function confirmedCandidates(engine, choices, state = engine.state, stamp = intentStateStamp(engine)) {
  const current = () => engine.state === state && !state.dead && intentStateStamp(engine) === stamp;
  return { choices, current, validate(id) {
    if (!current()) return null;
    const original = choices.find(c => c.id === id);
    const fresh = buildIntentCandidates(engine).find(c => c.id === id);
    return original && fresh && JSON.stringify(original.command) === JSON.stringify(fresh.command) ? fresh : null;
  } };
}

export async function suggestIntent(engine, input, resolver, { signal, onProgress } = {}) {
  if (!resolver || input.length > INTENT_INPUT_LIMIT || needsClarification(input)) return null;
  const candidates = buildIntentCandidates(engine);
  if (!candidates.length || candidates.length > 128) return null;
  const state = engine.state;
  const stamp = intentStateStamp(engine);
  const current = () => engine.state === state && !state.dead && intentStateStamp(engine) === stamp;
  let response;
  try {
    response = await resolver.resolve({ input, candidates: candidates.map(({ id, examples }) => ({ id, examples })) }, { signal, onProgress, isCurrent: current });
  } catch { return signal?.aborted ? null : { unavailable: true }; }
  if (signal?.aborted || !current() || response?.kind !== 'suggest' || !Array.isArray(response.candidateIds) ||
      !response.candidateIds.length || response.candidateIds.length > 3 ||
      Object.keys(response).some(k => !['kind', 'candidateIds'].includes(k))) return null;
  const ids = [...new Set(response.candidateIds)];
  const choices = ids.map(id => candidates.find(c => c.id === id));
  if (choices.some(c => !c)) return null;
  return confirmedCandidates(engine, choices, state, stamp);
}

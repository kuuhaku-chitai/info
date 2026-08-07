/**
 * 実音E2E（手動実行。run.mjsの一括対象外）
 * 前提: dev server（localhost:3000）と headless Chrome
 *   （--remote-debugging-port=9338 --autoplay-policy=no-user-gesture-required）が起動済み。
 * 検証: 再生開始 → stem WAV取得 → 音符の脈動 → --music-energy → 例外なし。
 */
const targetsRes = await fetch('http://localhost:9338/json/new?about:blank', { method: 'PUT' });
const target = await targetsRes.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
ws.binaryType = 'arraybuffer';
let id = 0;
const wavRequests = [];
const exceptions = [];
function send(method, params = {}) {
  return new Promise((resolve) => {
    const msgId = ++id;
    function onMessage(event) {
      const msg = JSON.parse(event.data);
      if (msg.id === msgId) { ws.removeEventListener('message', onMessage); resolve(msg.result); }
    }
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
ws.addEventListener('message', function onEvent(event) {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Network.requestWillBeSent' && msg.params.request.url.endsWith('.wav')) {
    wavRequests.push(msg.params.request.url);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params.exceptionDetails?.text ?? 'unknown');
  }
});
function evalJs(expression) { return send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Page.navigate', { url: 'http://localhost:3000/history' });
await wait(4500);

await evalJs(`document.querySelector('.music-toggle-corner')?.click()`);
await wait(500);
await evalJs(`[...document.querySelectorAll('[role="dialog"] button')].find(b => b.querySelector('svg path[d^="M8 5"]'))?.click()`);
await wait(15000); // デコード＋立ち上がり＋章の初回echoロード

const names = {};
for (const u of wavRequests) {
  const name = u.split('/').pop();
  names[name] = (names[name] ?? 0) + 1;
}
console.log('WAV取得内訳:', JSON.stringify(names));
console.log('例外:', exceptions.length === 0 ? 'なし' : exceptions.slice(0, 3));

assert(wavRequests.length >= 4 && wavRequests.length <= 8, `WAV取得は現行4＋echo0-2本 実測${wavRequests.length}`);
const pulsing = await evalJs(`document.querySelector('.music-toggle-corner')?.className.includes('pulse-whisper')`);
assert(pulsing.result.value === true, '再生中（音符が脈動）');
const energy = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--music-energy')`);
assert(Number(energy.result.value) > 0, `--music-energyが動いている (${energy.result.value})`);
assert(exceptions.length === 0, 'ランタイム例外なし');

console.log(failed === 0 ? '検証成功' : `${failed}件失敗`);
ws.close();
process.exit(failed === 0 ? 0 : 1);

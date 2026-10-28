// Gera o ícone do app a partir do logo vetorizado (app/public/icone-logo.svg): o fantasminha (versão moderna do ícone do Acadesc).
// Troca o selo redondo (gerar-icone.mjs, 5.8.5) pela escolha mais recente do Kevin.
// Uso (na pasta do projeto):  node ferramentas/gerar-icone-logo.mjs
// Saída: app/public/icone.ico (16 a 256 px), icone-256.png, icone.png (512 px),
// icone-192.png e icone-180.png (manifest PWA / apple-touch-icon, usados ao instalar como app no navegador).
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..');
const PUBLICO = path.join(RAIZ, 'app', 'public');
const TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256];
const TAMANHOS = [...TAMANHOS_ICO, 180, 192];
const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), 'icone-logo-'));
const url = (p) => 'file:///' + p.split(path.sep).join('/');

const svg = url(path.join(PUBLICO, 'icone-logo.svg'));
const pagina = `<!doctype html><meta charset="utf-8"><body><script>
function paraBase64(buf) {
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function gerar(tamanhos) {
  const img = new Image(); img.src = ${JSON.stringify(svg)}; await img.decode();
  const reduzir = (n) => { const c = new OffscreenCanvas(n, n), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, n, n); return c; };
  const saida = {};
  for (const n of tamanhos) {
    const blob = await reduzir(n).convertToBlob({ type: 'image/png' });
    saida[n] = paraBase64(new Uint8Array(await blob.arrayBuffer()));
  }
  const blob512 = await reduzir(512).convertToBlob({ type: 'image/png' });
  saida[512] = paraBase64(new Uint8Array(await blob512.arrayBuffer()));
  return JSON.stringify({ saida });
}
</script>`;

const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=9344',
  `--user-data-dir=${PASTA}/perfil`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let alvo;
  for (let i = 0; i < 40 && !alvo; i++) { await espera(250); try { alvo = (await (await fetch('http://127.0.0.1:9344/json')).json()).find((t) => t.type === 'page'); } catch {} }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const arq = path.join(PASTA, 'icone.html');
  fs.writeFileSync(arq, pagina);
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: url(arq) }); await espera(500);
  const r = await cdp('Runtime.evaluate', { expression: `gerar(${JSON.stringify(TAMANHOS)})`, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  const { saida } = JSON.parse(r.result.result.value);
  const pngs = TAMANHOS_ICO.map((n) => [n, Buffer.from(saida[n], 'base64')]);
  const cab = Buffer.alloc(6); cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let off = 6 + dir.length;
  pngs.forEach(([n, png], i) => {
    const o = i * 16;
    dir.writeUInt8(n >= 256 ? 0 : n, o); dir.writeUInt8(n >= 256 ? 0 : n, o + 1); dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6); dir.writeUInt32LE(png.length, o + 8); dir.writeUInt32LE(off, o + 12);
    off += png.length;
  });
  fs.writeFileSync(path.join(PUBLICO, 'icone.ico'), Buffer.concat([cab, dir, ...pngs.map(([, p]) => p)]));
  fs.writeFileSync(path.join(PUBLICO, 'icone-256.png'), pngs.find(([n]) => n === 256)[1]);
  fs.writeFileSync(path.join(PUBLICO, 'icone.png'), Buffer.from(saida[512], 'base64'));
  fs.writeFileSync(path.join(PUBLICO, 'icone-192.png'), Buffer.from(saida[192], 'base64'));
  fs.writeFileSync(path.join(PUBLICO, 'icone-180.png'), Buffer.from(saida[180], 'base64'));
  console.log('Ícone gerado em app/public/icone.ico (' + TAMANHOS_ICO.join(', ') + ' px), icone-256.png, icone.png (512), icone-192.png e icone-180.png');
  ws.close();
} finally {
  edge.kill(); await espera(800);
  try { fs.rmSync(PASTA, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { console.log('(a pasta temporária ' + PASTA + ' não pôde ser apagada agora; o Windows limpa depois)'); }
}

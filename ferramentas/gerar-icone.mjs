// 5.8.5 — Gera o ícone do app: o selo da rosa do Luterano (rosa + anel azul-claro + anel dourado), redondo, sem as letras.
// Histórico: "S" do SEK (5.8.3) e rosa sobre quadrado azul (5.8.4) foram reprovados; o Kevin escolheu o "selo redondo". Usa o logo da escola (app/public/logo.png): acha o anel
// dourado pela cor, recorta o círculo (rosa + anel azul-claro + anel dourado) e deixa de fora as letras e os pontinhos.
// Uso (na pasta do projeto):  node ferramentas/gerar-icone.mjs
// Saída: app/public/icone.ico (16 a 256 px) e app/public/icone-256.png.
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..');
const PUBLICO = path.join(RAIZ, 'app', 'public');
const TAMANHOS = [16, 24, 32, 48, 64, 128, 256];
const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), 'icone-'));
const url = (p) => 'file:///' + p.split(path.sep).join('/');

// Página que desenha tudo num canvas e devolve os PNGs de cada tamanho
const pagina = `<!doctype html><meta charset="utf-8"><body><script>
async function gerar(tamanhos) {
  const img = new Image(); img.src = ${JSON.stringify(url(path.join(PUBLICO, 'logo.png')))}; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c0 = new OffscreenCanvas(W, H), x0 = c0.getContext('2d'); x0.drawImage(img, 0, 0);
  const px = x0.getImageData(0, 0, W, H).data;
  // Anel dourado: pixels amarelos. O círculo externo dele é o limite do recorte (as letras ficam fora).
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    if (a > 160 && r > 170 && g > 110 && b < 110 && r - b > 90) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, raio = Math.max(maxX - minX, maxY - minY) / 2 + 8; // folga: o anel não é um círculo perfeito (as letras começam bem depois)
  // Emblema recortado em alta resolução (1024 px), com a borda do círculo suavizada
  const E = 1024, ce = new OffscreenCanvas(E, E), xe = ce.getContext('2d');
  xe.imageSmoothingQuality = 'high';
  xe.beginPath(); xe.arc(E / 2, E / 2, E / 2, 0, Math.PI * 2); xe.clip();
  xe.drawImage(img, cx - raio, cy - raio, raio * 2, raio * 2, 0, 0, E, E);
  // Reduz em etapas (fica nítido nos tamanhos pequenos)
  const reduzir = (fonte, n) => { let s = fonte, t = fonte.width;
    while (t / 2 >= n) { t = Math.round(t / 2); const c = new OffscreenCanvas(t, t), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(s, 0, 0, t, t); s = c; }
    const c = new OffscreenCanvas(n, n), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(s, 0, 0, n, n); return c; };
  const saida = {};
  for (const n of tamanhos) {
    const c = new OffscreenCanvas(n, n), x = c.getContext('2d');
    // 5.8.5 — "Selo redondo" (escolhido pelo Kevin entre 4 opções): o selo inteiro ocupa o ícone, fundo transparente em volta
    x.drawImage(reduzir(ce, n), 0, 0, n, n);
    const blob = await c.convertToBlob({ type: 'image/png' });
    saida[n] = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  }
  return JSON.stringify({ saida, anel: { cx, cy, raio, W, H } });
}
</script>`;

const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=9342',
  `--user-data-dir=${PASTA}/perfil`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let alvo;
  for (let i = 0; i < 40 && !alvo; i++) { await espera(250); try { alvo = (await (await fetch('http://127.0.0.1:9342/json')).json()).find((t) => t.type === 'page'); } catch {} }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const arq = path.join(PASTA, 'icone.html');
  fs.writeFileSync(arq, pagina);
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: url(arq) }); await espera(800);
  const r = await cdp('Runtime.evaluate', { expression: `gerar(${JSON.stringify(TAMANHOS)})`, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  const { saida, anel } = JSON.parse(r.result.result.value);
  const pngs = TAMANHOS.map((n) => [n, Buffer.from(saida[n], 'base64')]);
  // .ico com as imagens em PNG (Windows Vista em diante)
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
  if (process.argv.includes('--previa')) for (const [n, p] of pngs) fs.writeFileSync(path.join(process.argv[process.argv.indexOf('--previa') + 1], `icone-${n}.png`), p);
  console.log(`Anel dourado achado: centro (${Math.round(anel.cx)}, ${Math.round(anel.cy)}), raio ${Math.round(anel.raio)} px de ${anel.W}x${anel.H}`);
  console.log('Ícone gerado em app/public/icone.ico (' + TAMANHOS.join(', ') + ' px)');
  ws.close();
} finally {
  edge.kill(); await espera(800);
  // O Edge demora a soltar a pasta do perfil: tenta várias vezes e, se não der, avisa (é só uma pasta temporária)
  try { fs.rmSync(PASTA, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { console.log('(a pasta temporária ' + PASTA + ' não pôde ser apagada agora; o Windows limpa depois)'); }
}

// SEK — gerador de QR Code sem biblioteca externa (o app funciona sem internet).
// Segue a norma ISO/IEC 18004: modo byte (UTF-8), correção de erro nível M, versões 1 a 10 (até 213 bytes —
// sobra para um endereço como http://192.168.100.200:3000). Uso: gerarQR(texto) → texto <svg>.
// Conferido com o leitor de QR do OpenCV (ver HANDOFF, versão 5.5.0).
'use strict';

const gerarQR = (() => {
  // Tabelas do nível M, índice = versão (1 a 10)
  const ECC_POR_BLOCO = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const BLOCOS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const FORMATO_M = 0; // bits do nível M no campo de formato (L=1, M=0, Q=3, H=2)

  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function modulosDeDados(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  const palavrasDeDados = (ver) => Math.floor(modulosDeDados(ver) / 8) - ECC_POR_BLOCO[ver] * BLOCOS[ver];

  // Reed-Solomon no corpo GF(256), polinômio 0x11D
  function mult(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function divisor(grau) {
    const r = new Array(grau).fill(0); r[grau - 1] = 1;
    let raiz = 1;
    for (let i = 0; i < grau; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = mult(r[j], raiz); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      raiz = mult(raiz, 0x02);
    }
    return r;
  }
  function resto(dados, div) {
    const r = div.map(() => 0);
    for (const b of dados) {
      const f = b ^ r.shift(); r.push(0);
      div.forEach((c, i) => { r[i] ^= mult(c, f); });
    }
    return r;
  }

  // Divide em blocos, calcula a correção de cada um e intercala, como manda a norma
  function comCorrecao(dados, ver) {
    const nb = BLOCOS[ver], ecc = ECC_POR_BLOCO[ver], brutas = Math.floor(modulosDeDados(ver) / 8);
    const curtos = nb - (brutas % nb), tamCurto = Math.floor(brutas / nb), div = divisor(ecc);
    const blocos = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const d = dados.slice(k, k + tamCurto - ecc + (i < curtos ? 0 : 1)); k += d.length;
      const e = resto(d, div);
      if (i < curtos) d.push(0);
      blocos.push(d.concat(e));
    }
    const saida = [];
    for (let i = 0; i < blocos[0].length; i++) {
      blocos.forEach((b, j) => { if (i !== tamCurto - ecc || j >= curtos) saida.push(b[i]); });
    }
    return saida;
  }

  function posicoesAlinhamento(ver, tam) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2, passo = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2, r = [6];
    for (let p = tam - 7; r.length < n; p -= passo) r.splice(1, 0, p);
    return r;
  }

  return function gerarQR(texto) {
    const bytes = [...new TextEncoder().encode(String(texto))];
    let ver = 1;
    for (; ver <= 10; ver++) {
      const bitsContagem = ver <= 9 ? 8 : 16;
      if (4 + bitsContagem + bytes.length * 8 <= palavrasDeDados(ver) * 8) break;
    }
    if (ver > 10) throw new Error('Texto longo demais para o QR Code');

    // Fluxo de bits: modo byte (0100), quantidade, os bytes, terminador e enchimento
    const bits = [];
    const por = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    por(0b0100, 4); por(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach((b) => por(b, 8));
    const capacidade = palavrasDeDados(ver) * 8;
    por(0, Math.min(4, capacidade - bits.length));
    por(0, (8 - (bits.length % 8)) % 8);
    for (let p = 0xec; bits.length < capacidade; p ^= 0xec ^ 0x11) por(p, 8);
    const dados = [];
    for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

    const tam = ver * 4 + 17;
    const mod = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const fixo = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const marcar = (x, y, escuro) => { mod[y][x] = escuro; fixo[y][x] = true; };

    // Padrões fixos: linhas de tempo, os 3 quadrados dos cantos, alinhamento, formato e versão
    for (let i = 0; i < tam; i++) { marcar(6, i, i % 2 === 0); marcar(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < tam && y >= 0 && y < tam) marcar(x, y, d !== 2 && d !== 4);
      }
    }
    const al = posicoesAlinhamento(ver, tam), na = al.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) marcar(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const formato = (mascara) => {
      const d = (FORMATO_M << 3) | mascara;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) marcar(8, i, bit(b, i));
      marcar(8, 7, bit(b, 6)); marcar(8, 8, bit(b, 7)); marcar(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) marcar(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) marcar(tam - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) marcar(8, tam - 15 + i, bit(b, i));
      marcar(8, tam - 8, true);
    };
    formato(0);
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const a = tam - 11 + (i % 3), c = Math.floor(i / 3); marcar(a, c, bit(b, i)); marcar(c, a, bit(b, i)); }
    }

    // Os dados em zigue-zague, de baixo para cima, duas colunas por vez (pulando a coluna 6)
    const palavras = comCorrecao(dados, ver);
    let i = 0;
    for (let dir = tam - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;
      for (let v = 0; v < tam; v++) for (let j = 0; j < 2; j++) {
        const x = dir - j, subindo = ((dir + 1) & 2) === 0, y = subindo ? tam - 1 - v : v;
        if (!fixo[y][x] && i < palavras.length * 8) { mod[y][x] = bit(palavras[i >>> 3], 7 - (i & 7)); i++; }
      }
    }

    // Máscara: testa as 8 e fica com a que deixa o desenho mais fácil de ler (menor penalidade)
    const regra = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const aplicar = (m) => { for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fixo[y][x] && regra[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalidade = () => {
      let p = 0, escuros = 0;
      const linha = (get) => {
        for (let a = 0; a < tam; a++) {
          let corrida = 1;
          for (let b = 1; b <= tam; b++) {
            if (b < tam && get(a, b) === get(a, b - 1)) corrida++;
            else { if (corrida >= 5) p += 3 + (corrida - 5); corrida = 1; }
          }
          for (let b = 0; b + 11 <= tam; b++) {
            const s = Array.from({ length: 11 }, (_, k) => (get(a, b + k) ? '1' : '0')).join('');
            if (s === '10111010000' || s === '00001011101') p += 40;
          }
        }
      };
      linha((a, b) => mod[a][b]); linha((a, b) => mod[b][a]);
      for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
        if (mod[y][x]) escuros++;
        if (x < tam - 1 && y < tam - 1) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
      }
      const total = tam * tam;
      p += (Math.ceil(Math.abs(escuros * 20 - total * 10) / total) - 1) * 10;
      return p;
    };
    let melhor = 0, menor = Infinity;
    for (let m = 0; m < 8; m++) {
      aplicar(m); formato(m);
      const p = penalidade();
      if (p < menor) { menor = p; melhor = m; }
      aplicar(m);
    }
    aplicar(melhor); formato(melhor);

    // Desenho: 4 módulos de margem branca em volta (a "zona de silêncio" que o leitor precisa)
    const n = tam + 8;
    let d = '';
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (mod[y][x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    return `<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR Code: ${String(texto).replace(/[&<>"]/g, '')}"><rect class="qr-fundo" width="${n}" height="${n}"/><path class="qr-ponto" d="${d}"/></svg>`;
  };
})();

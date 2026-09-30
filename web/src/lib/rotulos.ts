/** Posicionamento de rótulos sem sobreposição (funções puras, sem DOM) -- usado pelo diagrama
 *  de acordes (rótulos de UF ao redor do anel), pelo Sankey (rótulos de nós) e pelos gráficos do
 *  Bloco 2 (rótulos de edição sobre pontos próximos). Em todos os casos o problema é o mesmo:
 *  rótulos de tamanho fixo, em pixels, disputando o espaço de elementos que o layout coloca
 *  muito perto uns dos outros (as UFs do Norte têm arcos de ~1° no anel; 2010 e 2022 caem a
 *  15 px no plano MEI×CMI). */

/** Afastamento angular MÍNIMO entre dois rótulos vizinhos ao redor de um círculo de raio `raio`,
 *  na posição `angulo` (radianos, 0 = topo, sentido horário -- a mesma convenção de d3-chord).
 *  Dois rótulos (caixas `larguraPx` x `alturaPx`) só se sobrepõem se o deslocamento entre eles
 *  for menor que a largura NO EIXO x e menor que a altura NO EIXO y ao mesmo tempo; andando
 *  pela tangente, (Δx, Δy) = Δs·(cos θ, sin θ), então o deslocamento de arco `Δs` que basta é
 *  `min(largura/|cos θ|, altura/|sin θ|)`. Perto do topo/base isso é a largura do rótulo; nas
 *  laterais, a altura. */
function afastamentoMinimo(angulo: number, raio: number, larguraPx: number, alturaPx: number): number {
  const c = Math.abs(Math.cos(angulo));
  const s = Math.abs(Math.sin(angulo));
  const ds = Math.min(c > 1e-9 ? larguraPx / c : Infinity, s > 1e-9 ? alturaPx / s : Infinity);
  return ds / raio;
}

/** Ajusta os ângulos dos rótulos ao redor de um círculo para que nenhum par vizinho se
 *  sobreponha. `angulos` vem em ordem crescente (a ordem dos grupos no anel) e o último é
 *  vizinho do primeiro (o anel fecha). Relaxamento iterativo: cada par que está mais perto que
 *  o mínimo é empurrado para os lados, metade para cada rótulo, repetidamente -- um grupo
 *  apertado (as 7 UFs do Norte) abre-se em leque simétrico em torno do próprio centro, em vez
 *  de empurrar tudo numa direção só. Devolve os novos ângulos (podem sair de [0, 2π): quem
 *  desenha só usa seno/cosseno). Um rótulo que já tem espaço não se move. */
export function posicionarRotulosAngulares(
  angulos: readonly number[], raio: number, larguraPx: number, alturaPx: number, iteracoes = 500,
): number[] {
  const n = angulos.length;
  const a = angulos.slice();
  if (n < 2 || !(raio > 0)) return a;
  const VOLTA = 2 * Math.PI;
  for (let it = 0; it < iteracoes; it++) {
    let moveu = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const d = j === 0 ? a[0] + VOLTA - a[i] : a[j] - a[i];
      const minimo = afastamentoMinimo((a[i] + (j === 0 ? a[0] + VOLTA : a[j])) / 2, raio, larguraPx, alturaPx);
      if (d < minimo - 1e-9) {
        const f = (minimo - d) / 2;
        a[i] -= f;
        a[j] += f;
        moveu = true;
      }
    }
    if (!moveu) break;
  }
  return a;
}

// --------------------------------------------------------------------------------------------

export type LadoRotulo = "acima" | "abaixo" | "direita" | "esquerda";

interface Retangulo { x0: number; y0: number; x1: number; y1: number }

const intersecao = (a: Retangulo, b: Retangulo): number => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
};

/** Escolhe de que lado de cada ponto (em pixels) colocar um rótulo de `larguraPx` x `alturaPx`,
 *  sem cobrir nenhum ponto (marcas de raio `raioPx`) nem outro rótulo já colocado e sem sair
 *  da área `0..larguraTotal` x `0..alturaTotal`. Guloso, na ordem dos pontos: para cada um, o
 *  primeiro lado de `ordem` sem colisão; se todos colidem, o de menor área de sobreposição.
 *  Devolve um lado por ponto. */
export function escolherLadosDosRotulos(
  pontos: readonly { x: number; y: number }[],
  larguraPx: number, alturaPx: number, raioPx: number,
  limites: { largura: number; altura: number },
  ordem: readonly LadoRotulo[] = ["acima", "abaixo", "direita", "esquerda"],
): LadoRotulo[] {
  const folga = 2;
  const marcas: Retangulo[] = pontos.map((p) => ({
    x0: p.x - raioPx, y0: p.y - raioPx, x1: p.x + raioPx, y1: p.y + raioPx,
  }));
  const caixa = (p: { x: number; y: number }, lado: LadoRotulo): Retangulo => {
    switch (lado) {
      case "acima": return { x0: p.x - larguraPx / 2, x1: p.x + larguraPx / 2, y1: p.y - raioPx - folga, y0: p.y - raioPx - folga - alturaPx };
      case "abaixo": return { x0: p.x - larguraPx / 2, x1: p.x + larguraPx / 2, y0: p.y + raioPx + folga, y1: p.y + raioPx + folga + alturaPx };
      case "direita": return { x0: p.x + raioPx + folga, x1: p.x + raioPx + folga + larguraPx, y0: p.y - alturaPx / 2, y1: p.y + alturaPx / 2 };
      case "esquerda": return { x1: p.x - raioPx - folga, x0: p.x - raioPx - folga - larguraPx, y0: p.y - alturaPx / 2, y1: p.y + alturaPx / 2 };
    }
  };
  const foraDaArea = (r: Retangulo) =>
    Math.max(0, -r.x0) + Math.max(0, r.x1 - limites.largura) +
    Math.max(0, -r.y0) + Math.max(0, r.y1 - limites.altura);

  const colocados: Retangulo[] = [];
  return pontos.map((p) => {
    let melhor: LadoRotulo = ordem[0];
    let melhorCusto = Infinity;
    for (const lado of ordem) {
      const r = caixa(p, lado);
      const custo = marcas.reduce((acc, m) => acc + intersecao(r, m), 0) +
        colocados.reduce((acc, c) => acc + intersecao(r, c), 0) +
        // sair da área pesa mais que uma sobreposição pequena, mas não é proibitivo
        foraDaArea(r) * alturaPx;
      if (custo < melhorCusto) { melhorCusto = custo; melhor = lado; }
      if (custo === 0) break;
    }
    colocados.push(caixa(p, melhor));
    return melhor;
  });
}

/** Nós de um diagrama aluvial (Sankey) cujos rótulos cabem sem colisão: dentro de cada coluna
 *  (mesmo `coluna`), prioriza os nós MAIORES (`tamanho`) e descarta os rótulos que cairiam a
 *  menos de `alturaPx` de um rótulo já aceito (centros em `y`). Devolve o conjunto dos `id`
 *  que mantêm o rótulo; os demais continuam desenhados (e com `<title>`), só sem texto fixo. */
export function rotulosVisiveisEmColunas(
  nos: readonly { id: string; coluna: number; y: number; tamanho: number }[], alturaPx: number,
): Set<string> {
  const visiveis = new Set<string>();
  const colunas = new Map<number, (typeof nos)[number][]>();
  for (const n of nos) {
    const grupo = colunas.get(n.coluna);
    if (grupo) grupo.push(n); else colunas.set(n.coluna, [n]);
  }
  for (const doGrupo of colunas.values()) {
    const aceitos: number[] = [];
    for (const n of [...doGrupo].sort((a, b) => b.tamanho - a.tamanho)) {
      if (aceitos.every((y) => Math.abs(y - n.y) >= alturaPx)) {
        aceitos.push(n.y);
        visiveis.add(n.id);
      }
    }
  }
  return visiveis;
}

/** F12.5 -- exportação client-side dos gráficos da seção "Ao longo dos censos" (seção 3,
 *  "toda figura tem tabela equivalente e botão Baixar CSV/Baixar PNG"). Sem servidor: CSV é
 *  serializado das próprias linhas de dado do gráfico; PNG é o SVG do Observable Plot
 *  serializado e desenhado num canvas (Plot sempre devolve SVG puro quando não pedimos
 *  `document: canvas`, ver https://observablehq.com/plot/features/plots). */

/** Serializa um array de objetos simples como CSV (vírgula, aspas quando necessário) e
 *  dispara o download no navegador. */
export function baixarCSV(nomeArquivo: string, linhas: Record<string, unknown>[]): void {
  if (linhas.length === 0) return;
  const colunas = Object.keys(linhas[0]);
  const escapar = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = [colunas.join(","), ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(","))].join("\n");
  const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Converte um `<svg>` (o que `Plot.plot()` devolve por padrão) num PNG e dispara o download.
 *  Serializa o SVG, desenha numa `<img>` temporária e depois num `<canvas>` do mesmo tamanho
 *  (2x para nitidez em telas de alta densidade). */
export function baixarSvgComoPng(nomeArquivo: string, svg: SVGSVGElement, escala = 2): void {
  const largura = svg.width.baseVal.value || svg.clientWidth || 400;
  const altura = svg.height.baseVal.value || svg.clientHeight || 300;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const texto = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([texto], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = nomeArquivo.endsWith(".png") ? nomeArquivo : `${nomeArquivo}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };
  img.src = url;
}

/** Par de botões "Baixar CSV"/"Baixar PNG" para uma figura -- `pegarSvg` lê o elemento SVG na
 *  hora do clique (evita guardar a ref o tempo todo em cada gráfico). */
export interface ExportarProps {
  nomeArquivo: string;
  linhasCsv: () => Record<string, unknown>[];
  pegarSvg: () => SVGSVGElement | null;
}

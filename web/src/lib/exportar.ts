/** Exportação em CSV do que está na tela.
 *
 *  Exporta apenas dados já publicados (agregados que passaram pelo gate de revelação),
 *  com o cabeçalho de fonte exigido pela política de uso dos microdados. */
import type { Fluxo, Municipio } from "./types";

const CABECALHO = [
  "# Atlas da migração interna no Brasil — Censo Demográfico 2022, migração de data fixa 2017–2022",
  "# Fonte: IBGE, Censo Demográfico 2022, microdados da amostra (acesso controlado).",
  "# Estimativas elaboradas pelo autor, sujeitas a erro amostral e a controle estatístico",
  "# de revelação; podem divergir das tabulações oficiais do IBGE (SIDRA).",
];

const escapar = (v: unknown): string => {
  if (v == null) return "";
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Monta o conteúdo do CSV (separador ";", o padrão do Excel em pt-BR).
 *  Função pura, separada do download para poder ser testada sem DOM. */
export function montarCsv(colunas: string[], linhas: unknown[][], notas: string[] = []): string {
  return [
    ...CABECALHO,
    ...notas.map((n) => `# ${n}`),
    colunas.join(";"),
    ...linhas.map((l) => l.map(escapar).join(";")),
  ].join("\n");
}

/** Monta o CSV e dispara o download no navegador. */
export function baixarCsv(nome: string, colunas: string[], linhas: unknown[][], notas: string[] = []) {
  const corpo = montarCsv(colunas, linhas, notas);
  const blob = new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarFluxos(m: Municipio, fluxos: (Fluxo & { direcao?: string })[], recorte: string | null) {
  baixarCsv(
    `fluxos_${m.nm_mun.toLowerCase().replace(/\s+/g, "_")}_${m.uf_sigla.toLowerCase()}`,
    ["direcao", "cd_origem", "nm_origem", "uf_origem", "cd_destino", "nm_destino", "uf_destino",
     "migrantes", "erro_padrao", "coef_variacao_pct", "obs_amostra", "precisao"],
    fluxos.map((f) => [
      f.direcao === "saida" ? "saída" : "entrada",
      f.origem, f.nm_origem, f.uf_origem, f.destino, f.nm_destino, f.uf_destino,
      f.total, f.se ?? "", f.cv ?? "", f.n_faixa, f.precisao,
    ]),
    [
      `Município de referência: ${m.nm_mun}/${m.uf_sigla} (${m.cd_mun}).`,
      recorte ? `Recorte aplicado: ${recorte}.` : "Sem recorte: todos os migrantes.",
      "Contagens ponderadas arredondadas a múltiplos de 5; observações amostrais em faixas.",
    ],
  );
}

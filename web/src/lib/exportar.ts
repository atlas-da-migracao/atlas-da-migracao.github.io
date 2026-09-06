/** Exportação em CSV do que está na tela.
 *
 *  Exporta apenas dados já publicados (agregados que passaram pelo gate de revelação),
 *  com o cabeçalho de fonte exigido pela política de uso dos microdados. */
import type { Fluxo, Municipio } from "./types";
import type { CaminhoSankeyResolvido } from "./rm";
import type { DetalhePendular, ResumoRM } from "../db/queries";

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

/** F6: exportação do par pendular exibido no PainelPendular (ida + volta, quando publicada). */
export function exportarPendular(
  ida: DetalhePendular, volta: DetalhePendular | null, tipo: "trab" | "estudo",
) {
  const colunasExtra = tipo === "trab" ? ["tempo_mediano_min", "pct_retorno_diario", "pct_transporte_coletivo"] : [];
  const linha = (d: DetalhePendular, direcao: string) => [
    direcao, d.origem, d.nm_origem, d.uf_origem, d.destino, d.nm_destino, d.uf_destino,
    d.total, d.se ?? "", d.cv ?? "", d.n_faixa, d.precisao,
    ...(tipo === "trab" ? [d.tempo_mediano ?? "", d.pct_diario ?? "", d.pct_coletivo ?? ""] : []),
  ];
  baixarCsv(
    `pendular_${tipo}_${ida.nm_origem.toLowerCase().replace(/\s+/g, "_")}_${ida.nm_destino.toLowerCase().replace(/\s+/g, "_")}`,
    ["direcao", "cd_origem", "nm_origem", "uf_origem", "cd_destino", "nm_destino", "uf_destino",
     "pessoas", "erro_padrao", "coef_variacao_pct", "obs_amostra", "precisao", ...colunasExtra],
    [linha(ida, "ida"), ...(volta ? [linha(volta, "volta")] : [])],
    [
      `Deslocamento pendular de ${tipo === "trab" ? "trabalho" : "estudo"}: ` +
        `${ida.nm_origem}/${ida.uf_origem} → ${ida.nm_destino}/${ida.uf_destino}.`,
      volta ? "Inclui o fluxo inverso (volta), quando publicado." : "Fluxo inverso abaixo do limiar de divulgação.",
      "Contagens ponderadas arredondadas a múltiplos de 5; observações amostrais em faixas.",
    ],
  );
}

/** F6: exportação de um ranking do PainelRM (ex.: saldo intra-RM por município). */
export function exportarRankingRM(
  resumo: ResumoRM, titulo: string, coluna: string, itens: { nome: string; valor: number }[],
) {
  baixarCsv(
    `${titulo}_${resumo.nm_rm.toLowerCase().replace(/\s+/g, "_")}`,
    ["municipio", coluna],
    itens.map((i) => [i.nome, i.valor]),
    [`Região metropolitana: ${resumo.nm_rm}.`],
  );
}

/** F6: exportação da tabela de caminhos do diagrama aluvial (morava em -> mora em -> trabalha em). */
export function exportarCaminhosAluvial(resumo: ResumoRM, caminhos: CaminhoSankeyResolvido[]) {
  baixarCsv(
    `caminhos_pendular_${resumo.nm_rm.toLowerCase().replace(/\s+/g, "_")}`,
    ["origem_2017", "residencia_2022", "trabalho_2022", "classe", "total", "faixa_amostra"],
    caminhos.map((c) => [c.origem, c.residencia, c.trabalho, c.classe, c.total, c.n_faixa]),
    [
      `Região metropolitana: ${resumo.nm_rm}.`,
      "Caminho morava em (2017) -> mora em (2022) -> trabalha em (2022); os 12 maiores caminhos da RM " +
        "com destino de trabalho conhecido, mais o agregado \"Outros municípios\".",
    ],
  );
}

/** F6: exportação dos fluxos de uma unidade agregada (RGI/RGInt/UF), exibidos no PainelUnidade. */
export function exportarFluxosUnidade(
  nivelRotulo: string, nome: string, fluxos: (Fluxo & { direcao?: string })[],
) {
  baixarCsv(
    `fluxos_${nivelRotulo.toLowerCase().replace(/\s+/g, "_")}_${nome.toLowerCase().replace(/\s+/g, "_")}`,
    ["direcao", "cd_origem", "nm_origem", "uf_origem", "cd_destino", "nm_destino", "uf_destino",
     "migrantes", "obs_amostra", "precisao"],
    fluxos.map((f) => [
      f.direcao === "saida" ? "saída" : "entrada",
      f.origem, f.nm_origem, f.uf_origem, f.destino, f.nm_destino, f.uf_destino,
      f.total, f.n_faixa, f.precisao,
    ]),
    [
      `Unidade de referência (${nivelRotulo}): ${nome}.`,
      "Nível agregado: soma dos fluxos municipais publicados; sem erro-padrão próprio " +
        "(ver metodologia). Migração entre municípios da mesma unidade não é contabilizada.",
      "Contagens ponderadas arredondadas a múltiplos de 5; observações amostrais em faixas.",
    ],
  );
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

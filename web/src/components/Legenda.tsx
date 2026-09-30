import { useState } from "react";
import type { Metrica } from "../lib/types";
import { corDaFaixa, corSemDado, faixasLegenda } from "../lib/escalas";
import { num } from "../lib/format";
import { alturaEspigaPx } from "../lib/espigas";

// F5 (mapa-representação): métricas de CONTAGEM (saldo, imigrantes, emigrantes) trocam a
// legenda de faixas de cor (coroplético) por espigas de referência -- ver MapaAtlas.tsx,
// ESPIGAS_METRICAS (mesmo conjunto, duplicado aqui só para não puxar deck.gl/@luma.gl neste
// módulo leve, igual já acontece com LARGURA_MIN/MAX abaixo).
const METRICAS_ESPIGA = new Set<Metrica>(["saldo", "imig", "emig"]);
/** Teto da amostra na LEGENDA, menor que o teto do mapa (`TETO_ESPIGA_PX` em lib/espigas.ts,
 *  120px) -- é só um ícone de referência, não precisa do mesmo tamanho da maior espiga real. */
const TETO_ESPIGA_LEGENDA_PX = 30;
const alturaAmostraEspiga = (fracaoDoMaior: number, maiorAbsoluto: number) =>
  alturaEspigaPx(fracaoDoMaior * maiorAbsoluto, maiorAbsoluto, TETO_ESPIGA_LEGENDA_PX);

// F3 (mapa-representação): mesma escala de espessura dos fluxos (ver larguraDoArco em
// map/MapaAtlas.tsx) -- reproduzida aqui só para desenhar as 3 amostras da legenda, sem
// importar o componente do mapa (evita puxar deck.gl/@luma.gl para este módulo leve).
const LARGURA_MIN = 1.5, LARGURA_MAX = 14;
const larguraDaAmostra = (fracao: number) => LARGURA_MIN + (LARGURA_MAX - LARGURA_MIN) * Math.sqrt(fracao);
/** Frações do maior fluxo da edição usadas como referência: um fluxo pequeno (5%), um
 *  mediano (30%) e o maior fluxo publicado (100%) -- não há percentil pronto no meta.json,
 *  então usamos frações fixas em vez de uma consulta SQL nova só para isto. */
const FRACOES_AMOSTRA = [0.05, 0.3, 1];

const TITULOS: Record<Metrica, string> = {
  saldo: "Saldo migratório (pessoas)",
  tlm: "Taxa líquida de migração (por mil)",
  imig: "Imigrantes (pessoas)",
  emig: "Emigrantes (pessoas)",
  iem: "Índice de eficácia migratória (%)",
};

export function Legenda({ metrica, quebras, escuro, notaNivel, maiorFluxo, maiorAbsolutoMetrica,
                          categoriasFluxo, titulo, notaFluxo, menorFluxo, limiteFluxos, escopoFluxos,
                          fluxosLigados = true, semDado }: {
  metrica: Metrica; quebras: number[]; escuro: boolean;
  /** F6: rótulo do nível agregado ativo (ex.: "Reg. imediata"); omitido no nível município. */
  notaNivel?: string;
  /** Âncora da escala de espessura dos fluxos -- base das 3 amostras abaixo. É a MESMA que o
   *  mapa usa (App.tsx calcula uma vez e passa aos dois): o maior fluxo municipal de migração da
   *  edição (meta.maior_fluxo) só vale no nível município e nas abas de migração; nos níveis
   *  agregados e no pendular o número certo é o maior da tabela de fluxos daquele nível/aba,
   *  senão os maiores arcos saturam em 14 px e a legenda anuncia um volume que o mapa não usa.
   *  `null`/ausente enquanto não há âncora: a nota de espessura cai de volta ao texto genérico. */
  maiorFluxo?: number | null;
  /** F5 (mapa-representação): maior |valor| da métrica ativa ENTRE AS UNIDADES VISÍVEIS no
   *  nível ativo (calculado em App.tsx, mesma âncora usada pelas espigas do mapa -- ver
   *  MapaAtlas.tsx) -- base das 3 amostras de comprimento abaixo, só quando `metrica` é de
   *  contagem (saldo/imig/emig). `null`/ausente cai num texto genérico sem números. */
  maiorAbsolutoMetrica?: number | null;
  /** F11 (mapa-representação): no modo metropolitano o mapa recebe `modoRM` (MapaAtlas.tsx) e
   *  não pinta a malha nem desenha espigas -- preenchimento neutro, e o único dado em tela são os
   *  fluxos INTRA-RM, cuja COR é categórica (tipologia do fluxo na aba de migração;
   *  origem-destino do deslocamento nas abas de pendular). Quando estas categorias são passadas,
   *  a legenda troca as faixas/espigas por elas e usa `titulo` no lugar do título da métrica --
   *  a métrica não está representada no mapa neste modo. */
  categoriasFluxo?: readonly { rotulo: string; cor: string }[];
  /** Título que substitui o da métrica quando `categoriasFluxo` é passado. */
  titulo?: string;
  /** Nota extra sobre as cores dos fluxos (ex.: o que significa um fluxo esmaecido). */
  notaFluxo?: string;
  /** Volume do MENOR fluxo desenhado no mapa nesta vista -- o corte efetivo da camada de
   *  fluxos. O mapa nacional não desenha os ~53 mil pares publicados: desenha só os maiores (ver
   *  `maioresFluxos` em db/queries.ts e o seletor "top N"), e sem este número o leitor não tem
   *  como saber que a ausência de um fluxo no mapa não significa ausência de migração. O corte
   *  muda de edição para edição (os volumes de 1980 não são os de 2022) e com o próprio "top N",
   *  então é medido nos fluxos em tela, não fixado na metodologia. `null` (fluxos desligados,
   *  nada desenhado) omite a nota: não há corte a descrever. */
  menorFluxo?: number | null;
  /** Limite de fluxos da consulta: no escopo "pais", o total de maiores fluxos da vista (fixo,
   *  igual em todas as edições); no escopo "selecao", o "top N" de CADA lado (entrada e saída). */
  limiteFluxos?: number;
  /** De onde vêm os fluxos: "pais" (vista nacional, maiores do país/nível) ou "selecao"
   *  (entrada e saída do lugar selecionado). A frase do corte muda: só a nacional tem um número
   *  fixo entre as edições -- um município pequeno de 1980 pode ter menos fluxos que o limite. */
  escopoFluxos?: "pais" | "selecao";
  /** false quando a camada de fluxos está desligada: a legenda não descreve o que o mapa não
   *  desenha (fita, espessura, corte). */
  fluxosLigados?: boolean;
  /** Rótulo da entrada "sem dado" (cinza próprio, distinto de "baixa variação"), nas métricas
   *  coropléticas. `null`/ausente = nenhuma unidade sem dado na vista. */
  semDado?: string | null;
}) {
  // A legenda começa recolhida num chip em telas de até ~1100 px (celular, tablet e notebook
  // estreito: aberta, ela cobria o oeste do Brasil -- auditoria de 30/09/2026); acima disso
  // começa aberta. Em ambos os tamanhos, o botão no título permite minimizá-la de volta ao chip.
  const [aberta, setAberta] = useState(() =>
    typeof window === "undefined" || !window.matchMedia("(max-width: 1100px)").matches);
  const unidade = metrica === "tlm" ? "‰" : metrica === "iem" ? "%" : "";
  const faixas = faixasLegenda(quebras, unidade);
  if (!aberta) {
    return (
      <button type="button" className="legenda-chip" onClick={() => setAberta(true)}
              aria-expanded={false} aria-controls="legenda-painel">
        Legenda
      </button>
    );
  }
  return (
    <div className="legenda" id="legenda-painel">
      <div className="legenda-titulo">
        {titulo ?? TITULOS[metrica]}
        <button type="button" className="fechar legenda-fechar" onClick={() => setAberta(false)}
                aria-label="Minimizar legenda">×</button>
      </div>
      {categoriasFluxo ? (
        <ul>
          {categoriasFluxo.map((c) => (
            <li key={c.rotulo}>
              <span className="amostra" style={{ background: c.cor }} />
              {c.rotulo}
            </li>
          ))}
        </ul>
      ) : METRICAS_ESPIGA.has(metrica) ? (
        // F5 (mapa-representação): contagem (saldo/imig/emig) não pinta a malha -- o valor sai
        // em espigas bipolares (MapaAtlas.tsx), então a legenda mostra espigas de referência em
        // vez de faixas de cor. Saldo tem os dois polos (ganho para cima, perda para baixo);
        // imigrantes/emigrantes têm só um polo, sempre para cima, na cor de entrada/saída.
        <div className="legenda-espigas" aria-label="Comprimento da espiga cresce com a raiz quadrada do valor; amostras de referência">
          <div className="legenda-espigas-polo">
            <div className="legenda-espigas-amostras">
              {FRACOES_AMOSTRA.map((f) => (
                <span key={f} className="espiga-amostra"
                      style={{
                        height: maiorAbsolutoMetrica ? alturaAmostraEspiga(f, maiorAbsolutoMetrica) : 6 + 18 * f,
                        background: metrica === "emig" ? "var(--arc-out)" : "var(--arc-in)",
                      }} />
              ))}
            </div>
            <span className="legenda-espigas-rotulo">
              {metrica === "saldo" ? "ganho" : metrica === "imig" ? "imigrantes" : "emigrantes"}
            </span>
          </div>
          {metrica === "saldo" && (
            <div className="legenda-espigas-polo">
              <div className="legenda-espigas-amostras espiga-baixo">
                {FRACOES_AMOSTRA.map((f) => (
                  <span key={f} className="espiga-amostra"
                        style={{
                          height: maiorAbsolutoMetrica ? alturaAmostraEspiga(f, maiorAbsolutoMetrica) : 6 + 18 * f,
                          background: "var(--arc-out)",
                        }} />
                ))}
              </div>
              <span className="legenda-espigas-rotulo">perda</span>
            </div>
          )}
          <em className="legenda-espigas-valores">
            {maiorAbsolutoMetrica
              ? `${FRACOES_AMOSTRA.map((f) => num(Math.round(f * maiorAbsolutoMetrica))).join(" · ")} pessoas`
              : "comprimento cresce com a raiz quadrada do valor"}
          </em>
        </div>
      ) : (
        <ul>
          {faixas.map((f, i) => (
            <li key={i}>
              <span className="amostra" style={{ background: corDaFaixa(f.nivel, f.sinal, escuro) }} />
              {f.rotulo}
            </li>
          ))}
          {semDado && (
            <li>
              <span className="amostra" style={{ background: corSemDado(escuro) }} />
              {semDado}
            </li>
          )}
        </ul>
      )}
      {fluxosLigados && (
      <div className="legenda-nota">
        {/* F11 (mapa-representação): a direção de um fluxo deixou de ser lida pela cor
            (azul/laranja, que colidia com a mesma dupla nas espigas e no coroplético
            divergente) -- agora é lida pela FORMA: a fita AFUNILA da origem para o destino,
            termina numa SETA, e um NÓ circular marca as duas pontas. A amostra em CSS abaixo
            (triângulo + seta + dois pontos) é só um ícone de referência dessa forma, não usa
            deck.gl. */}
        Fluxos: fita afunila da origem ao destino, termina em seta; um círculo marca cada ponta
        <div className="legenda-fluxo-amostra" aria-hidden="true">
          <span className="legenda-fluxo-no" />
          <span className="legenda-fluxo-fita" />
          <span className="legenda-fluxo-seta" />
          <span className="legenda-fluxo-no" />
        </div>
        {notaFluxo && <div className="legenda-nota-fluxo">{notaFluxo}</div>}
        {maiorFluxo ? (
          <div className="legenda-espessura" aria-label="Espessura da fita cresce com a raiz quadrada do volume; amostras de referência">
            {FRACOES_AMOSTRA.map((f) => (
              <span key={f} style={{ height: larguraDaAmostra(f) }} />
            ))}
            <em>
              {FRACOES_AMOSTRA.map((f) => num(Math.round(f * maiorFluxo))).join(" · ")} pessoas
            </em>
          </div>
        ) : (
          <div className="legenda-espessura" aria-label="Espessura da fita cresce com o volume, na raiz quadrada">
            <span style={{ height: 2 }} /><span style={{ height: 5 }} /><span style={{ height: 9 }} />
            <em>espessura cresce com o volume (raiz quadrada)</em>
          </div>
        )}
        {menorFluxo != null && (
          <div className="legenda-nota-fluxo">
            Corte: {escopoFluxos === "selecao"
              ? `o mapa desenha só os maiores fluxos de entrada e de saída do lugar selecionado${
                  limiteFluxos ? ` (até ${num(limiteFluxos)} de cada lado)` : ""}`
              : `o mapa desenha só os ${limiteFluxos ? `${num(limiteFluxos)} ` : ""}maiores fluxos do país${
                  limiteFluxos ? " (o mesmo número em todas as edições)" : ""}`}.
            {" "}O menor fluxo desenhado tem <strong>{num(menorFluxo)}</strong> pessoas: pares abaixo desse
            volume existem nos dados e no painel, mas não aparecem no mapa.
          </div>
        )}
      </div>
      )}
      {notaNivel && (
        <div className="legenda-nota">
          Nível agregado ({notaNivel}): migração entre municípios da mesma unidade não é
          contabilizada; pares suprimidos ficam fora da soma; sem erro-padrão publicado.
        </div>
      )}
    </div>
  );
}

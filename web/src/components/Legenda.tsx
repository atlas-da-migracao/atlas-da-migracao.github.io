import { useState } from "react";
import type { Metrica } from "../lib/types";
import { corDaFaixa, faixasLegenda } from "../lib/escalas";
import { num } from "../lib/format";

// F3 (mapa-representação): mesma escala de espessura do ArcLayer (ver larguraDoArco em
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

export function Legenda({ metrica, quebras, escuro, notaNivel, maiorFluxo }: {
  metrica: Metrica; quebras: number[]; escuro: boolean;
  /** F6: rótulo do nível agregado ativo (ex.: "Reg. imediata"); omitido no nível município. */
  notaNivel?: string;
  /** F3 (mapa-representação): maior fluxo municipal publicado nesta edição (meta.maior_fluxo)
   *  -- base das 3 amostras de espessura abaixo. `null`/ausente enquanto meta.json não
   *  carregou: a nota de espessura cai de volta ao texto genérico anterior. */
  maiorFluxo?: number | null;
}) {
  // A legenda começa recolhida num chip no mobile, para não cobrir o mapa; no desktop
  // começa aberta. Em ambos os tamanhos, o botão no título permite minimizá-la de volta ao chip.
  const [aberta, setAberta] = useState(() =>
    typeof window === "undefined" || !window.matchMedia("(max-width: 700px)").matches);
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
        {TITULOS[metrica]}
        <button type="button" className="fechar legenda-fechar" onClick={() => setAberta(false)}
                aria-label="Minimizar legenda">×</button>
      </div>
      <ul>
        {faixas.map((f, i) => (
          <li key={i}>
            <span className="amostra" style={{ background: corDaFaixa(f.nivel, f.sinal, escuro) }} />
            {f.rotulo}
          </li>
        ))}
      </ul>
      <div className="legenda-nota">
        Arcos: <span className="amostra pequena" style={{ background: "var(--arc-in)" }} /> entradas ·{" "}
        <span className="amostra pequena" style={{ background: "var(--arc-out)" }} /> saídas
        {maiorFluxo ? (
          <div className="legenda-espessura" aria-label="Espessura da linha cresce com a raiz quadrada do volume; amostras de referência">
            {FRACOES_AMOSTRA.map((f) => (
              <span key={f} style={{ height: larguraDaAmostra(f) }} />
            ))}
            <em>
              {FRACOES_AMOSTRA.map((f) => num(Math.round(f * maiorFluxo))).join(" · ")} pessoas
            </em>
          </div>
        ) : (
          <div className="legenda-espessura" aria-label="Espessura da linha cresce com o volume, na raiz quadrada">
            <span style={{ height: 2 }} /><span style={{ height: 5 }} /><span style={{ height: 9 }} />
            <em>espessura cresce com o volume (raiz quadrada)</em>
          </div>
        )}
      </div>
      {notaNivel && (
        <div className="legenda-nota">
          Nível agregado ({notaNivel}): migração entre municípios da mesma unidade não é
          contabilizada; pares suprimidos ficam fora da soma; sem erro-padrão publicado.
        </div>
      )}
    </div>
  );
}

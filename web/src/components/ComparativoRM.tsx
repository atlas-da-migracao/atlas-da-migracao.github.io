/** Comparativo entre as 20 maiores regiões metropolitanas: mig_intra, saldo externo
 *  (barra divergente), % pendular, tempo mediano e % coletivo (barras embutidas).
 *  Ordenável por clique no cabeçalho; a RM ativa fica destacada. Tempo mediano e % coletivo
 *  só aparecem em edições com esses recursos (ver lib/edicoes.ts) -- 2010 não tem quesito
 *  de tempo em minutos nem de meio de transporte. */
import { useMemo, useState } from "react";
import type { ResumoRM } from "../db/queries";
import { edicao, type Censo } from "../lib/edicoes";
import { num, num1, sinal } from "../lib/format";

interface Props {
  rms: ResumoRM[];
  ativa: string;
  censo: Censo;
  aoEscolher: (cd_rm: string) => void;
}

type Coluna = "pop" | "mig_intra" | "saldo_externo" | "pct_pendular" | "tempo_mediano" | "pct_coletivo";

const TODAS_COLUNAS: { chave: Coluna; rotulo: string }[] = [
  { chave: "pop", rotulo: "População" },
  { chave: "mig_intra", rotulo: "Migração intra-RM" },
  { chave: "saldo_externo", rotulo: "Saldo externo" },
  { chave: "pct_pendular", rotulo: "% pendular" },
  { chave: "tempo_mediano", rotulo: "Tempo mediano" },
  { chave: "pct_coletivo", rotulo: "% coletivo" },
];

export function ComparativoRM({ rms, ativa, censo, aoEscolher }: Props) {
  const recursos = edicao(censo).recursos;
  const COLUNAS = TODAS_COLUNAS.filter((c) =>
    (c.chave !== "pct_pendular" || recursos.pendular) &&
    (c.chave !== "tempo_mediano" || recursos.tempoMinutos) &&
    (c.chave !== "pct_coletivo" || recursos.modo));
  const [ordem, setOrdem] = useState<{ col: Coluna; dir: 1 | -1 }>({ col: "pop", dir: -1 });

  const top20 = useMemo(() => [...rms].sort((a, b) => b.pop - a.pop).slice(0, 20), [rms]);
  const ordenadas = useMemo(() => {
    const v = (r: ResumoRM) => (r[ordem.col] ?? 0) as number;
    return [...top20].sort((a, b) => (v(a) - v(b)) * ordem.dir);
  }, [top20, ordem]);

  const maxAbsSaldo = Math.max(1, ...top20.map((r) => Math.abs(r.saldo_externo)));
  const maxPendular = Math.max(1, ...top20.map((r) => r.pct_pendular ?? 0));
  const maxColetivo = Math.max(1, ...top20.map((r) => r.pct_coletivo ?? 0));

  const alternarOrdem = (col: Coluna) =>
    setOrdem((o) => (o.col === col ? { col, dir: o.dir === 1 ? -1 : 1 } : { col, dir: -1 }));

  return (
    <div className="comparativo-rm">
      <div className="tabela-scroll">
        <table className="tabela-comparativo">
          <thead>
            <tr>
              <th>Região metropolitana</th>
              {COLUNAS.map((c) => (
                <th key={c.chave}>
                  <button className="th-ordenar" onClick={() => alternarOrdem(c.chave)}>
                    {c.rotulo}{ordem.col === c.chave ? (ordem.dir === 1 ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((r) => (
              <tr key={r.cd_rm} className={r.cd_rm === ativa ? "ativa" : ""}
                  onClick={() => aoEscolher(r.cd_rm)}
                  tabIndex={0} role="button" aria-pressed={r.cd_rm === ativa}
                  aria-label={`Ver ${r.nm_rm}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoEscolher(r.cd_rm); }
                  }}>
                <td>
                  <strong>{r.nm_rm}</strong>
                  <span className="muted-pequeno"> · {r.nm_nucleo} · {r.n_municipios} mun.</span>
                </td>
                <td className="valor-cel">{num(r.pop)}</td>
                <td className="valor-cel">{num(r.mig_intra)}</td>
                <td className="barra-cel-comp">
                  <div className="barra-divergente-comp">
                    <span className={r.saldo_externo < 0 ? "neg" : "pos"}
                          style={{ width: `${(Math.abs(r.saldo_externo) / maxAbsSaldo) * 100}%` }} />
                  </div>
                  <span className="valor-inline">{sinal(r.saldo_externo)}</span>
                </td>
                {recursos.pendular && (
                  <td className="barra-cel-comp">
                    <div className="barra-embutida">
                      <span style={{ width: `${((r.pct_pendular ?? 0) / maxPendular) * 100}%` }} />
                    </div>
                    <span className="valor-inline">{r.pct_pendular != null ? `${num1(r.pct_pendular)}%` : "—"}</span>
                  </td>
                )}
                {recursos.tempoMinutos && (
                  <td className="valor-cel">{r.tempo_mediano != null ? `${num(r.tempo_mediano)} min` : "—"}</td>
                )}
                {recursos.modo && (
                  <td className="barra-cel-comp">
                    <div className="barra-embutida">
                      <span style={{ width: `${((r.pct_coletivo ?? 0) / maxColetivo) * 100}%` }} />
                    </div>
                    <span className="valor-inline">{r.pct_coletivo != null ? `${num1(r.pct_coletivo)}%` : "—"}</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { Metrica } from "../lib/types";
import { corDaFaixa, faixasLegenda } from "../lib/escalas";

const TITULOS: Record<Metrica, string> = {
  saldo: "Saldo migratório (pessoas)",
  tlm: "Taxa líquida de migração (por mil)",
  imig: "Imigrantes (pessoas)",
  emig: "Emigrantes (pessoas)",
  iem: "Índice de eficácia migratória (%)",
};

export function Legenda({ metrica, quebras, escuro }: { metrica: Metrica; quebras: number[]; escuro: boolean }) {
  const unidade = metrica === "tlm" ? "‰" : metrica === "iem" ? "%" : "";
  const faixas = faixasLegenda(quebras, unidade);
  return (
    <div className="legenda">
      <div className="legenda-titulo">{TITULOS[metrica]}</div>
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
        <div className="legenda-espessura" aria-label="Espessura proporcional ao volume">
          <span style={{ height: 2 }} /><span style={{ height: 5 }} /><span style={{ height: 9 }} />
          <em>espessura ∝ √volume</em>
        </div>
      </div>
    </div>
  );
}

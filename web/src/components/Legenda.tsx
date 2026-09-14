import { useState } from "react";
import type { Metrica } from "../lib/types";
import { corDaFaixa, faixasLegenda } from "../lib/escalas";

const TITULOS: Record<Metrica, string> = {
  saldo: "Saldo migratório (pessoas)",
  tlm: "Taxa líquida de migração (por mil)",
  imig: "Imigrantes (pessoas)",
  emig: "Emigrantes (pessoas)",
  iem: "Índice de eficácia migratória (%)",
};

export function Legenda({ metrica, quebras, escuro, notaNivel }: {
  metrica: Metrica; quebras: number[]; escuro: boolean;
  /** F6: rótulo do nível agregado ativo (ex.: "Reg. imediata"); omitido no nível município. */
  notaNivel?: string;
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
        <div className="legenda-espessura" aria-label="Espessura da linha cresce com o volume, na raiz quadrada">
          <span style={{ height: 2 }} /><span style={{ height: 5 }} /><span style={{ height: 9 }} />
          <em>espessura cresce com o volume (raiz quadrada)</em>
        </div>
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

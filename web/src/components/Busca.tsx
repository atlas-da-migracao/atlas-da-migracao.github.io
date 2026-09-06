import { useMemo, useState } from "react";
import type { Municipio } from "../lib/types";

/** Busca por município, sem acentuação e sem distinção de caixa. */
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Busca({ municipios, aoEscolher }: {
  municipios: Municipio[]; aoEscolher: (cd: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);

  const indice = useMemo(
    () => municipios.map((m) => ({ cd: m.cd_mun, rotulo: `${m.nm_mun}/${m.uf_sigla}`, chave: normalizar(`${m.nm_mun} ${m.uf_sigla}`), pop: m.pop })),
    [municipios],
  );

  const resultados = useMemo(() => {
    const q = normalizar(texto.trim());
    if (q.length < 2) return [];
    return indice
      .filter((m) => m.chave.includes(q))
      .sort((a, b) => (a.chave.startsWith(q) === b.chave.startsWith(q) ? b.pop - a.pop : a.chave.startsWith(q) ? -1 : 1))
      .slice(0, 8);
  }, [texto, indice]);

  return (
    <div className="busca">
      <input
        type="search"
        value={texto}
        placeholder="Buscar município…"
        aria-label="Buscar município"
        onChange={(e) => { setTexto(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && resultados[0]) { aoEscolher(resultados[0].cd); setTexto(""); setAberto(false); }
          if (e.key === "Escape") { setTexto(""); setAberto(false); }
        }}
      />
      {aberto && resultados.length > 0 && (
        <ul className="resultados">
          {resultados.map((r) => (
            <li key={r.cd}>
              <button onMouseDown={() => { aoEscolher(r.cd); setTexto(""); setAberto(false); }}>
                {r.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

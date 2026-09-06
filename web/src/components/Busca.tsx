import { useMemo, useState } from "react";

/** Busca por município, sem acentuação e sem distinção de caixa. Generalizada na F6 para
 *  também buscar regiões imediatas/intermediárias e UFs -- o chamador decide os itens
 *  (`itens`) de acordo com o nível de agregação ativo. */
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface ItemBusca { codigo: string; rotulo: string; peso: number }

export function Busca({ itens, placeholder = "Buscar município…", aoEscolher }: {
  itens: ItemBusca[]; placeholder?: string; aoEscolher: (codigo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);

  const indice = useMemo(
    () => itens.map((i) => ({ ...i, chave: normalizar(i.rotulo) })),
    [itens],
  );

  const resultados = useMemo(() => {
    const q = normalizar(texto.trim());
    if (q.length < 2) return [];
    return indice
      .filter((m) => m.chave.includes(q))
      .sort((a, b) => (a.chave.startsWith(q) === b.chave.startsWith(q) ? b.peso - a.peso : a.chave.startsWith(q) ? -1 : 1))
      .slice(0, 8);
  }, [texto, indice]);

  return (
    <div className="busca">
      <input
        type="search"
        value={texto}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => { setTexto(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && resultados[0]) { aoEscolher(resultados[0].codigo); setTexto(""); setAberto(false); }
          if (e.key === "Escape") { setTexto(""); setAberto(false); }
        }}
      />
      {aberto && resultados.length > 0 && (
        <ul className="resultados">
          {resultados.map((r) => (
            <li key={r.codigo}>
              <button onMouseDown={() => { aoEscolher(r.codigo); setTexto(""); setAberto(false); }}>
                {r.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Filtro por característica do migrante.
 *  Recorta mapa, arcos e tabelas a um subgrupo -- por exemplo, só quem tem superior
 *  completo, ou só quem voltou ao município natal. */
import { DIMENSOES, type NomeDimensao, cor } from "../lib/paletas";
import { edicao } from "../lib/edicoes";
import { useStore } from "../state/store";

const ORDEM: NomeDimensao[] = ["status", "edu", "renda"];
/** categorias residuais não fazem sentido como recorte analítico */
const OCULTAS = new Set(["outros", "nao_determinado", "nao_aplicavel"]);

export function Filtro({ valor, aoMudar, escuro }: {
  valor: string | null; aoMudar: (v: string | null) => void; escuro: boolean;
}) {
  // "status" é a única dimensão cujo vocabulário difere por edição (ver docs/METODOLOGIA.md,
  // "Edição Censo 2010 e comparabilidade") -- as demais categorias existem em todas.
  const censo = useStore((s) => s.censo);
  const ed = edicao(censo);
  const statusValidos = new Set(ed.statusCategorias);
  // sem renda em edições que não publicam essa dimensão (hoje só 1980, ver lib/edicoes.ts
  // `recursos.renda`) -- mesmo padrão usado para "modo"/"tempoMinutos" em PainelPendular.tsx.
  const dimensoesAtivas = ORDEM.filter((dim) => dim !== "renda" || ed.recursos.renda);
  const [dimAtiva, catAtiva] = valor ? (valor.split("__") as [NomeDimensao, string]) : [null, null];
  const atual = dimAtiva && catAtiva
    ? DIMENSOES[dimAtiva].categorias.find((c) => c.chave === catAtiva)
    : null;

  return (
    <div className="filtro">
      <label htmlFor="filtro-sel">Recorte:</label>
      <select id="filtro-sel" value={valor ?? ""} onChange={(e) => aoMudar(e.target.value || null)}>
        <option value="">Todos os migrantes</option>
        {dimensoesAtivas.map((dim) => (
          <optgroup key={dim} label={DIMENSOES[dim].titulo}>
            {DIMENSOES[dim].categorias
              .filter((c) => !OCULTAS.has(c.chave))
              .filter((c) => dim !== "status" || statusValidos.has(c.chave))
              .map((c) => (
                <option key={c.chave} value={`${dim}__${c.chave}`}>{c.rotulo}</option>
              ))}
          </optgroup>
        ))}
      </select>
      {atual && (
        <span className="filtro-marca">
          <span className="amostra pequena" style={{ background: cor(atual.cor, escuro) }} />
          <button onClick={() => aoMudar(null)} aria-label="Limpar recorte">limpar</button>
        </span>
      )}
    </div>
  );
}

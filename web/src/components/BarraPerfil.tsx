/** Barras 100% empilhadas para comparar perfis.
 *
 *  Marcas seguem a skill dataviz: 2px de respiro entre segmentos, extremidades
 *  arredondadas, rótulos diretos só nos segmentos grandes o suficiente, e legenda
 *  sempre presente -- a identidade nunca fica só na cor.
 */
import type { Categoria } from "../lib/paletas";
import { cor } from "../lib/paletas";
import { num1 } from "../lib/format";
import { corTextoLegivel } from "../lib/contraste";

export interface SeriePerfil {
  rotulo: string;
  valores: Record<string, number>;
  destaque?: boolean;
}

interface Props {
  titulo: React.ReactNode;
  nota?: string | null;
  categorias: readonly Categoria[];
  series: SeriePerfil[];
  escuro: boolean;
  /** F12.5: texto específico para uma série sem dado, por edição/série (ex.: "não medido
   *  nesta edição", quando o motivo é a comparabilidade entre censos -- ver
   *  docs/design_serie_censos.md, 3.4-a). Sem esta prop, o texto genérico "sem dado
   *  publicável" continua valendo (uso atual, dentro de uma única edição). */
  motivoVazio?: (serie: SeriePerfil) => string | null;
}

export function BarraPerfil({ titulo, nota, categorias, series, escuro, motivoVazio }: Props) {
  const usadas = categorias.filter((c) => series.some((s) => (s.valores[c.chave] ?? 0) > 0));
  if (usadas.length === 0) return null;

  return (
    <section className="perfil">
      <h4>
        {titulo}
        {nota && <span className="perfil-nota"> · {nota}</span>}
      </h4>

      {series.map((s) => {
        const total = usadas.reduce((acc, c) => acc + (s.valores[c.chave] ?? 0), 0);
        if (total <= 0) {
          return (
            <div className="perfil-linha" key={s.rotulo}>
              <div className="perfil-rotulo">{s.rotulo}</div>
              <div className="perfil-vazio">{motivoVazio?.(s) ?? "sem dado publicável"}</div>
            </div>
          );
        }
        return (
          <div className={`perfil-linha${s.destaque ? " destaque" : ""}`} key={s.rotulo}>
            <div className="perfil-rotulo">{s.rotulo}</div>
            <div className="perfil-barra" role="img"
                 aria-label={`${s.rotulo}: ${usadas.map((c) =>
                   `${c.rotulo} ${num1(((s.valores[c.chave] ?? 0) / total) * 100)}%`).join(", ")}`}>
              {usadas.map((c) => {
                const pct = ((s.valores[c.chave] ?? 0) / total) * 100;
                if (pct <= 0) return null;
                const fundo = cor(c.cor, escuro);
                return (
                  <span key={c.chave} className="perfil-seg"
                        style={{ width: `${pct}%`, background: fundo }}
                        title={`${c.rotulo}: ${num1(pct)}%`}>
                    {/* F6 leva 2: cor do texto escolhida por contraste (WCAG >= 4,5:1), não fixa em
                        branco -- o fundo muda por categoria/tema e alguns segmentos claros só
                        passavam com texto escuro (ver lib/contraste.ts). */}
                    {pct >= 12 && <em style={{ color: corTextoLegivel(fundo) }}>{Math.round(pct)}%</em>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      <ul className="perfil-legenda">
        {usadas.map((c) => (
          <li key={c.chave}>
            <span className="amostra pequena" style={{ background: cor(c.cor, escuro) }} />
            {c.rotulo}
          </li>
        ))}
      </ul>
    </section>
  );
}

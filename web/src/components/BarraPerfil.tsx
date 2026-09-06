/** Barras 100% empilhadas para comparar perfis.
 *
 *  Marcas seguem a skill dataviz: 2px de respiro entre segmentos, extremidades
 *  arredondadas, rótulos diretos só nos segmentos grandes o suficiente, e legenda
 *  sempre presente -- a identidade nunca fica só na cor.
 */
import type { Categoria } from "../lib/paletas";
import { cor } from "../lib/paletas";
import { num1 } from "../lib/format";

export interface SeriePerfil {
  rotulo: string;
  valores: Record<string, number>;
  destaque?: boolean;
}

interface Props {
  titulo: string;
  nota?: string | null;
  categorias: readonly Categoria[];
  series: SeriePerfil[];
  escuro: boolean;
}

export function BarraPerfil({ titulo, nota, categorias, series, escuro }: Props) {
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
              <div className="perfil-vazio">sem dado publicável</div>
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
                return (
                  <span key={c.chave} className="perfil-seg"
                        style={{ width: `${pct}%`, background: cor(c.cor, escuro) }}
                        title={`${c.rotulo}: ${num1(pct)}%`}>
                    {pct >= 12 && <em>{Math.round(pct)}%</em>}
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

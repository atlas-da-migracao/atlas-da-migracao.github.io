/** Pirâmide etária compacta (F6 leva 2, pendência 10b): homens à esquerda, mulheres à
 *  direita, mesma cor por sexo (slots 1 e 5 da paleta categórica de 8), com uma referência
 *  (ex.: imigrantes do destino, ou residentes do município) sobreposta como contorno
 *  tracejado. Valores em % do total do grupo. */
import { prepararPiramide } from "../lib/piramide";
import { CATEGORICO_8, cor as corDeCategoria } from "../lib/paletas";
import { num1 } from "../lib/format";

const COR_HOMENS = CATEGORICO_8[0];
const COR_MULHERES = CATEGORICO_8[4];

interface Props {
  titulo: string;
  rotuloGrupo: string;
  valoresGrupo: Record<string, number>;
  rotuloReferencia?: string;
  valoresReferencia?: Record<string, number>;
  escuro: boolean;
}

export function PiramideIdadeSexo({ titulo, rotuloGrupo, valoresGrupo, rotuloReferencia,
                                    valoresReferencia, escuro }: Props) {
  const grupo = prepararPiramide(valoresGrupo);
  const ref = valoresReferencia ? prepararPiramide(valoresReferencia) : null;
  if (grupo.total <= 0) return null;

  const maiorPct = Math.max(
    ...grupo.pontos.map((p) => Math.max(p.pctHomens, p.pctMulheres)),
    ...(ref?.pontos.map((p) => Math.max(p.pctHomens, p.pctMulheres)) ?? [0]),
    1,
  );
  const larguraPct = (v: number) => `${(v / maiorPct) * 100}%`;

  const corH = corDeCategoria(COR_HOMENS, escuro);
  const corM = corDeCategoria(COR_MULHERES, escuro);

  const rotuloAria = [
    `${titulo}. ${rotuloGrupo}:`,
    ...grupo.pontos.map((p) =>
      `${p.rotulo} anos, homens ${num1(p.pctHomens)}%, mulheres ${num1(p.pctMulheres)}%`),
    ref && rotuloReferencia ? `Referência (${rotuloReferencia}):` : "",
    ...(ref?.pontos.map((p) =>
      `${p.rotulo} anos, homens ${num1(p.pctHomens)}%, mulheres ${num1(p.pctMulheres)}%`) ?? []),
  ].filter(Boolean).join(" ");

  return (
    <section className="perfil">
      <h4>{titulo}</h4>
      <div className="piramide" role="img" aria-label={rotuloAria}>
        {grupo.pontos.map((p, i) => {
          const r = ref?.pontos[i];
          return (
            <div className="piramide-linha" key={p.chave}>
              <div className="piramide-barra homens">
                <span className="fill" style={{ width: larguraPct(p.pctHomens), background: corH }} />
                {r && <span className="ref" style={{ width: larguraPct(r.pctHomens) }} />}
              </div>
              <div className="piramide-faixa">{p.rotulo}</div>
              <div className="piramide-barra mulheres">
                <span className="fill" style={{ width: larguraPct(p.pctMulheres), background: corM }} />
                {r && <span className="ref" style={{ width: larguraPct(r.pctMulheres) }} />}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="piramide-legenda">
        <li><span className="amostra pequena" style={{ background: corH }} /> Homens ({rotuloGrupo})</li>
        <li><span className="amostra pequena" style={{ background: corM }} /> Mulheres ({rotuloGrupo})</li>
        {ref && rotuloReferencia && (
          <li><span className="amostra pequena" style={{ border: "1.5px dashed var(--ink)", background: "transparent" }} /> {rotuloReferencia}</li>
        )}
      </ul>
    </section>
  );
}

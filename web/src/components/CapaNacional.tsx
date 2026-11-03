/** F6 leva 2: capa nacional -- o que aparece no painel quando não há seleção (nível
 *  município, modo Brasil). Números do Brasil calculados no DuckDB, os maiores fluxos
 *  do país e os três achados-chave já validados na pesquisa (números fixos, checados
 *  contra a metodologia -- não uma consulta ao vivo, porque cruzam bases distintas). */
import { useEffect, useState } from "react";
import { alcanceNacional, capaBrasil, maioresFluxos, type CapaBrasil } from "../db/queries";
import type { Fluxo, Meta } from "../lib/types";
import { num, num1 } from "../lib/format";
import { rotuloRecorte } from "../lib/paletas";
import { useT } from "../i18n";
import { useStore } from "../state/store";
import { edicao } from "../lib/edicoes";
import { AvisoProxy } from "./AvisoProxy";
import { tipoFluxoPredominante } from "../lib/serie";
import { Termo } from "./Termo";
import { TextoRico } from "./TextoRico";

interface Props {
  aoSelecionarFluxo: (o: string, d: string) => void;
  /** chave do recorte ativo (ex.: "renda__mais_de_2_sm"), ou null */
  recorte?: string | null;
  meta: Meta | null;
}

export function CapaNacional({ aoSelecionarFluxo, recorte = null, meta }: Props) {
  const d = useT();
  const [capa, setCapa] = useState<CapaBrasil | null>(null);
  const [top5, setTop5] = useState<Fluxo[]>([]);
  const [alcance, setAlcance] = useState<{ distancia_media: number | null; pct_interestadual: number | null } | null>(null);
  const censo = useStore((s) => s.censo);
  const irPara = useStore((s) => s.irPara);
  const ed = edicao(censo);

  // F4: reconsulta ao trocar de edição -- capaBrasil()/maioresFluxos() já vão para a conexão
  // DuckDB certa (consultar() usa a edição ativa por padrão), mas o efeito só reroda se
  // `censo` estiver nas dependências.
  useEffect(() => {
    let vivo = true;
    setCapa(null);
    capaBrasil().then((c) => { if (vivo) setCapa(c); }).catch(() => {});
    return () => { vivo = false; };
  }, [censo]);

  useEffect(() => {
    let vivo = true;
    setAlcance(null);
    alcanceNacional().then((a) => { if (vivo) setAlcance(a); }).catch(() => {});
    return () => { vivo = false; };
  }, [censo]);

  // A lista é zerada ao trocar de edição (e de recorte): durante a carga a frio da edição nova
  // (10-18 s na primeira visita) ela ficava com os maiores fluxos da anterior sob o título da
  // nova, e com o rótulo do recorte antigo sob o novo. `alcance` e `capa` já faziam isto.
  useEffect(() => {
    let vivo = true;
    setTop5([]);
    maioresFluxos(5, recorte).then((f) => { if (vivo) setTop5(f); }).catch(() => {});
    return () => { vivo = false; };
  }, [censo, recorte]);

  const milhoes = capa ? capa.total_migrantes / 1_000_000 : null;

  return (
    <aside className="painel" aria-label={d.capa.aria}>
      <div className="vazio">
        <h2>{d.capa.titulo}</h2>
        <p>
          {d.capa.intro(capa ? num(capa.n_municipios) : null, ed.periodo.de.slice(0, 4),
                        ed.periodo.ate.slice(0, 4), ed.nome, Boolean(ed.proxyDataFixa))}
        </p>
      </div>

      <AvisoProxy meta={meta} />

      {capa && milhoes != null && (
        <>
          <div className="capa-nacional-numero">
            {d.capa.numeroDestaque(num1(milhoes), ed.periodo.de.slice(0, 4), ed.periodo.ate.slice(0, 4))}
          </div>
          <p className="muted-pequeno">
            {d.capa.apoio(num(capa.n_pares), num(capa.imig_ni), num(capa.imig_int), num(capa.pop5))}
          </p>
        </>
      )}

      {(() => {
        const tipo = alcance ? tipoFluxoPredominante(alcance.distancia_media, alcance.pct_interestadual, d) : null;
        return tipo && (
          <p className="muted-pequeno">
            <Termo chave="tipo_fluxo_predominante">{d.capa.padraoPredominante}</Termo>{d.capa.padraoSufixo}
            {" "}<strong>{tipo.rotulo.toLowerCase()}</strong>.
          </p>
        );
      })()}

      {top5.length > 0 && (
        <section className="secao">
          <h3>{d.capa.maioresFluxos}</h3>
          {recorte && (
            <p className="muted-pequeno explicacao">
              {d.capa.recorteRotulo} <strong>{rotuloRecorte(recorte, d)}</strong> {d.capa.recorteExplicacao}
            </p>
          )}
          <ul className="capa-nacional-lista">
            {top5.map((f) => (
              <li key={`${f.origem}-${f.destino}`}>
                <button onClick={() => aoSelecionarFluxo(f.origem, f.destino)}>
                  <span>
                    {f.nm_origem}<span className="uf">/{f.uf_origem}</span>
                    <span className="seta"> → </span>
                    {f.nm_destino}<span className="uf">/{f.uf_destino}</span>
                  </span>
                  <span className="valor-cel">{num(f.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* "Três achados" são números específicos, checados à mão contra a edição 2022 (dois
          dependem do módulo metropolitano). A partir da edição Censo 2010, o módulo
          metropolitano também existe (`recursos.rm` é true nas duas edições), mas esses
          números específicos NÃO foram recalculados/replicados para 2010 -- por isso o gate
          aqui é `censo === "2022"`, não `ed.recursos.rm`. */}
      {censo === "2022" && (
        <section className="secao">
          <h3>{d.capa.achados.titulo}</h3>

          <div className="achado">
            <p><TextoRico texto={d.capa.achados.nucleo(num1(46.5), num1(59.3))} /></p>
            <button onClick={() => irPara({ rm: "7801", aba: "mig", municipio: null, selecao: null,
                                            origem: null, destino: null })}>
              {d.capa.achados.verRideDF}
            </button>
          </div>

          <div className="achado">
            <p><TextoRico texto={d.capa.achados.superior(num1(75.1))} /></p>
            <button onClick={() => aoSelecionarFluxo("3304557", "3550308")}>
              {d.capa.achados.verFluxoRioSP}
            </button>
          </div>

          <div className="achado">
            <p><TextoRico texto={d.capa.achados.pendular(num(77500))} /></p>
            <button onClick={() => irPara({ rm: "4901", aba: "trab", municipio: null, selecao: null,
                                            origem: "3518800", destino: "3550308" })}>
              {d.capa.achados.verParPendular}
            </button>
          </div>
        </section>
      )}

      <p className="muted-pequeno">{d.capa.instrucao}</p>
    </aside>
  );
}

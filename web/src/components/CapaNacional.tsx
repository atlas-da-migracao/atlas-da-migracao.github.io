/** F6 leva 2: capa nacional -- o que aparece no painel quando não há seleção (nível
 *  município, modo Brasil). Números do Brasil calculados no DuckDB, os maiores fluxos
 *  do país e os três achados-chave já validados na pesquisa (números fixos, checados
 *  contra a metodologia -- não uma consulta ao vivo, porque cruzam bases distintas). */
import { useEffect, useState } from "react";
import { capaBrasil, maioresFluxos, type CapaBrasil } from "../db/queries";
import type { Fluxo, Meta } from "../lib/types";
import { num, num1 } from "../lib/format";
import { rotuloRecorte } from "../lib/paletas";
import { useStore } from "../state/store";
import { edicao } from "../lib/edicoes";
import { AvisoProxy } from "./AvisoProxy";

interface Props {
  aoSelecionarFluxo: (o: string, d: string) => void;
  /** chave do recorte ativo (ex.: "renda__mais_de_2_sm"), ou null */
  recorte?: string | null;
  meta: Meta | null;
}

export function CapaNacional({ aoSelecionarFluxo, recorte = null, meta }: Props) {
  const [capa, setCapa] = useState<CapaBrasil | null>(null);
  const [top5, setTop5] = useState<Fluxo[]>([]);
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
    maioresFluxos(5, recorte).then((f) => { if (vivo) setTop5(f); }).catch(() => {});
    return () => { vivo = false; };
  }, [censo, recorte]);

  const milhoes = capa ? capa.total_migrantes / 1_000_000 : null;

  return (
    <aside className="painel" aria-label="Panorama nacional">
      <div className="vazio">
        <h2>Atlas da migração interna</h2>
        <p>
          Fluxos migratórios entre {capa ? `os ${num(capa.n_municipios)}` : "os"} municípios
          brasileiros no quinquênio {ed.periodo.de.slice(0, 4)}–{ed.periodo.ate.slice(0, 4)},
          {ed.proxyDataFixa
            ? ` a partir de um proxy de data fixa do Censo Demográfico ${ed.nome} (ver aviso abaixo).`
            : ` a partir do quesito de data fixa do Censo Demográfico ${ed.nome}.`}
        </p>
      </div>

      <AvisoProxy meta={meta} />

      {capa && milhoes != null && (
        <>
          <div className="capa-nacional-numero">
            {num1(milhoes)} milhões de pessoas mudaram de município entre {ed.periodo.de.slice(0, 4)}
            {" "}e {ed.periodo.ate.slice(0, 4)}
          </div>
          <p className="muted-pequeno">
            {num(capa.n_pares)} pares origem–destino publicados · {num(capa.imig_ni)} chegadas
            com origem não informada · {num(capa.imig_int)} vindas do exterior · população de
            referência (5 anos ou mais): {num(capa.pop5)}.
          </p>
        </>
      )}

      {top5.length > 0 && (
        <section className="secao">
          <h3>Maiores fluxos do país</h3>
          {recorte && (
            <p className="muted-pequeno explicacao">
              Recorte: <strong>{rotuloRecorte(recorte)}</strong> -- volume só desse subgrupo de migrantes.
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
          <h3>Três achados da pesquisa</h3>

          <div className="achado">
            <p>
              Entre quem saiu do núcleo metropolitano para a periferia, <strong>46,5%</strong>{" "}
              seguem trabalhando no núcleo -- na RIDE-DF, essa taxa chega a <strong>59,3%</strong>.
            </p>
            <button onClick={() => irPara({ rm: "7801", aba: "mig", municipio: null, selecao: null,
                                            origem: null, destino: null })}>
              Ver a RIDE-DF
            </button>
          </div>

          <div className="achado">
            <p>
              Entre os migrantes de 25 anos ou mais do Rio de Janeiro para São Paulo,{" "}
              <strong>75,1%</strong> têm superior completo -- uma seletividade educacional acentuada.
            </p>
            <button onClick={() => aoSelecionarFluxo("3304557", "3550308")}>
              Ver o fluxo Rio → São Paulo
            </button>
          </div>

          <div className="achado">
            <p>
              Guarulhos → São Paulo é o maior par pendular de trabalho do país:{" "}
              <strong>77.500 pessoas</strong> moram em Guarulhos e trabalham em São Paulo.
            </p>
            <button onClick={() => irPara({ rm: "4901", aba: "trab", municipio: null, selecao: null,
                                            origem: "3518800", destino: "3550308" })}>
              Ver o par pendular
            </button>
          </div>
        </section>
      )}

      <p className="muted-pequeno">
        Clique em um município no mapa para ver seu saldo, os principais fluxos de entrada e
        de saída, e o perfil dos migrantes. Clique em um arco para detalhar um fluxo.
      </p>
    </aside>
  );
}

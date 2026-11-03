/** Painel do fluxo selecionado: volume, precisão, o fluxo reverso e o perfil dos
 *  migrantes daquele par, comparado com três referências. */
import { useEffect, useState } from "react";
import { usarDuckDBPronto } from "../db/duckdb";
import {
  destinosTrabalhoDoFluxo, detalheDoFluxo, referenciasDoPerfil, rmDoPar, type DetalheFluxo,
} from "../db/queries";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { PiramideIdadeSexo } from "./PiramideIdadeSexo";
import { DIMENSOES, dimensao, rotuloClasseTrab, type NomeDimensao } from "../lib/paletas";
import { useT } from "../i18n";
import { ic95, num, num1, rotuloPrecisao, sinal } from "../lib/format";
import { edicao } from "../lib/edicoes";
import { useStore } from "../state/store";
import { AvisoProxy } from "./AvisoProxy";
import { unidadeAgregada } from "./AvisoUnidade";
import type { Meta } from "../lib/types";
import { Termo } from "./Termo";

interface Props {
  origem: string;
  destino: string;
  escuro: boolean;
  aoFechar: () => void;
  aoAbrirMunicipio: (cd: string) => void;
  meta: Meta | null;
}

type Refs = Awaited<ReturnType<typeof referenciasDoPerfil>>;

/** Extrai as colunas largas de uma dimensão (ex.: edu__superior_completo). */
function doFluxo(f: DetalheFluxo | null, dim: NomeDimensao): Record<string, number> {
  const out: Record<string, number> = {};
  if (!f) return out;
  for (const c of DIMENSOES[dim].categorias) {
    const v = f[`${dim}__${c.chave}`];
    if (typeof v === "number") out[c.chave] = v;
  }
  return out;
}

/** Igual a `doFluxo`, mas para dimensões sem entrada em DIMENSOES (idade_sexo: as chaves
 *  "<faixa>_m"/"<faixa>_f" não têm rótulo/cor próprios, são lidas direto por PiramideIdadeSexo). */
function colunasLargasDoFluxo(f: DetalheFluxo | null, prefixo: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!f) return out;
  const pfx = `${prefixo}__`;
  for (const [chave, v] of Object.entries(f)) {
    if (chave.startsWith(pfx) && typeof v === "number") out[chave.slice(pfx.length)] = v;
  }
  return out;
}

function daReferencia(refs: Refs, cd: string, direcao: string, dim: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of refs) {
    if (r.cd_mun === cd && r.direcao === direcao && r.dimensao === dim) out[r.categoria] = r.valor;
  }
  return out;
}

export function PainelFluxo({ origem, destino, escuro, aoFechar, aoAbrirMunicipio, meta }: Props) {
  const d = useT();
  const ed = edicao(useStore((s) => s.censo));
  const { periodo } = ed;
  const temRenda = ed.recursos.renda;
  const [dados, setDados] = useState<Awaited<ReturnType<typeof detalheDoFluxo>> | null>(null);
  const [refs, setRefs] = useState<Refs>([]);
  const [carregando, setCarregando] = useState(true);
  const [destinosTrabalho, setDestinosTrabalho] = useState<Awaited<ReturnType<typeof destinosTrabalhoDoFluxo>>>([]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    Promise.all([detalheDoFluxo(origem, destino), referenciasDoPerfil(origem, destino)])
      .then(([det, r]) => { if (vivo) { setDados(det); setRefs(r); } })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [origem, destino]);

  // se o par pertence a uma RM, busca onde os migrantes desse percurso trabalham
  useEffect(() => {
    let vivo = true;
    setDestinosTrabalho([]);
    rmDoPar(origem, destino).then((cd_rm) => {
      if (!cd_rm) return null;
      return destinosTrabalhoDoFluxo(cd_rm, origem, destino);
    }).then((r) => { if (vivo && r) setDestinosTrabalho(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [origem, destino]);

  const pronto = usarDuckDBPronto();
  if (carregando) return <aside className="painel" aria-label={d.comum.ui.painelDetalhes}><p className="muted">{pronto ? d.comum.ui.carregandoFluxo : d.paineis.preparandoDados}</p></aside>;

  const ida = dados?.ida ?? null;
  const volta = dados?.volta ?? null;

  if (!ida) {
    return (
      <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
        <header className="painel-topo">
          <h2>{d.paineis.fluxo.naoPublicado}</h2>
          <button className="fechar" onClick={aoFechar} aria-label={d.comum.ui.fecharPainel}>×</button>
        </header>
        <p className="muted">{d.paineis.fluxo.naoPublicadoMotivo(meta?.revelacao.min_pessoas ?? 5)}</p>
      </aside>
    );
  }

  const saldoPar = ida.total - (volta?.total ?? 0);
  // "os dois municípios" só vale quando as duas pontas SÃO municípios: uma unidade agregada da
  // edição (meta.unidades_agregadas; nenhuma edição a usa desde 1.1.0-1980) cobre vários e não
  // é um município
  const algumaAgregada = unidadeAgregada(meta, ida.origem) != null || unidadeAgregada(meta, ida.destino) != null;
  const parDeTerritorios = algumaAgregada ? d.paineis.fluxo.parUnidades : d.comum.niveis.mun.par;

  return (
    <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">
            {d.paineis.fluxo.titulo(periodo.de.slice(0, 4), periodo.ate.slice(0, 4))}
          </div>
          <h2 className="titulo-fluxo">
            <button className="link-mun" onClick={() => aoAbrirMunicipio(ida.origem)}>
              {ida.nm_origem}<span className="uf">/{ida.uf_origem}</span>
            </button>
            <span className="seta">→</span>
            <button className="link-mun" onClick={() => aoAbrirMunicipio(ida.destino)}>
              {ida.nm_destino}<span className="uf">/{ida.uf_destino}</span>
            </button>
          </h2>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label={d.comum.ui.fecharPainel}>×</button>
      </header>

      <AvisoProxy meta={meta} />

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-rotulo">{d.paineis.fluxo.migrantesNoFluxo}</div>
          <div className="kpi-valor">{num(ida.total)}</div>
          <div className="kpi-detalhe"><Termo chave="ic95">{d.paineis.termos.ic95}</Termo>{d.paineis.dp} {ic95(ida.total, ida.se)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">{d.paineis.fluxoInverso}</div>
          <div className="kpi-valor">{volta ? num(volta.total) : "—"}</div>
          <div className="kpi-detalhe">
            {volta ? `${ida.nm_destino} → ${ida.nm_origem}` : d.paineis.fluxo.abaixoLimiar}
          </div>
        </div>
        <div className="kpi kpi-largo">
          <div className="kpi-rotulo">{d.paineis.fluxo.saldoPar}</div>
          <div className="kpi-valor">{sinal(saldoPar)}</div>
          <div className="kpi-detalhe">
            {saldoPar > 0
              ? d.paineis.ganhaNaTroca(ida.nm_destino, num(Math.abs(saldoPar)), Math.abs(saldoPar), ida.nm_origem)
              : saldoPar < 0
              ? d.paineis.ganhaNaTroca(ida.nm_origem, num(Math.abs(saldoPar)), Math.abs(saldoPar), ida.nm_destino)
              : d.paineis.trocaEquilibrada(parDeTerritorios)}
          </div>
        </div>
      </div>

      <div className="nota-precisao">
        <Termo chave="precisao">{d.paineis.termos.precisao}</Termo>{d.paineis.dp} <strong>{rotuloPrecisao(ida.precisao, d)}</strong>
        {ida.cv != null && <> (<Termo chave="cv">{d.paineis.termos.coefVariacao}</Termo> {d.paineis.pct(num1(ida.cv))})</>} ·{" "}
        <Termo chave="n_faixa">{d.paineis.observacoes(ida.n_faixa)}</Termo>{d.paineis.naAmostra}
      </div>

      {!ida.tem_detalhe ? (
        <p className="aviso">
          {d.paineis.fluxo.perfilNaoPublicado(meta?.revelacao.min_pessoas_detalhe ?? 20)}
        </p>
      ) : (
        <>
          <h3 className="secao-titulo">{d.paineis.perfilMigrantes}</h3>
          <p className="muted-pequeno explicacao">{d.paineis.fluxo.explicacaoPerfil}</p>
          {(["status", "edu", "renda"] as NomeDimensao[])
            .filter((dim) => dim !== "renda" || temRenda)
            .map((dim) => {
            const series: SeriePerfil[] = [
              { rotulo: d.paineis.nesteFluxo, valores: doFluxo(ida, dim), destaque: true },
              { rotulo: d.paineis.fluxo.imigrantesDe(ida.nm_destino), valores: daReferencia(refs, ida.destino, "imig", dim) },
              { rotulo: d.paineis.fluxo.emigrantesDe(ida.nm_origem), valores: daReferencia(refs, ida.origem, "emig", dim) },
            ];
            // status migratório só existe para migrantes: não faz sentido comparar
            // com a população residente, que por definição não migrou no período
            if (dim !== "status") {
              series.push({
                rotulo: d.paineis.fluxo.residentesDe(ida.nm_destino),
                valores: daReferencia(refs, ida.destino, "residente", dim),
              });
            }
            const glossarioDim: Record<string, string> = {
              status: "status_migratorio", edu: "escolaridade", renda: "renda_domiciliar",
            };
            const chaveGlossario = glossarioDim[dim];
            const dimLocal = dimensao(dim, d);
            return (
              <BarraPerfil key={dim}
                           titulo={chaveGlossario ? <Termo chave={chaveGlossario}>{dimLocal.titulo}</Termo> : dimLocal.titulo}
                           nota={dimLocal.nota}
                           categorias={dimLocal.categorias} series={series} escuro={escuro} />
            );
          })}
          <PiramideIdadeSexo
            titulo={<Termo chave="idade_sexo">{d.paineis.termos.idadeSexo}</Termo>} rotuloGrupo={d.paineis.nesteFluxo}
            valoresGrupo={colunasLargasDoFluxo(ida, "idade_sexo")}
            rotuloReferencia={d.paineis.fluxo.imigrantesDe(ida.nm_destino)}
            valoresReferencia={daReferencia(refs, ida.destino, "imig", "idade_sexo")}
            escuro={escuro}
          />
        </>
      )}

      {destinosTrabalho.length > 0 && (
        <>
          <h3 className="secao-titulo">{d.paineis.fluxo.ondeTrabalham}</h3>
          <p className="muted-pequeno explicacao">
            {d.paineis.fluxo.ondeTrabalhamNota(ida.nm_origem, ida.nm_destino, periodo.ate.slice(0, 4))}
          </p>
          <table className="tabela-fluxos">
            <tbody>
              {destinosTrabalho.map((dt, i) => (
                <tr key={i}>
                  <td>
                    {dt.nm_destino_trab
                      ? <>{dt.nm_destino_trab}<span className="uf">/{dt.uf_destino_trab}</span></>
                      : rotuloClasseTrab(dt.classe_trab, d)}
                  </td>
                  <td className="valor-cel">{num(dt.total)}</td>
                  <td className="valor-cel muted-pequeno">{dt.n_faixa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </aside>
  );
}

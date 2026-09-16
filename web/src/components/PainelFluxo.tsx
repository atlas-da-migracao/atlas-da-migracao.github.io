/** Painel do fluxo selecionado: volume, precisão, o fluxo reverso e o perfil dos
 *  migrantes daquele par, comparado com três referências. */
import { useEffect, useState } from "react";
import { usarDuckDBPronto } from "../db/duckdb";
import {
  destinosTrabalhoDoFluxo, detalheDoFluxo, referenciasDoPerfil, rmDoPar, type DetalheFluxo,
} from "../db/queries";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { PiramideIdadeSexo } from "./PiramideIdadeSexo";
import { CLASSE_TRAB, DIMENSOES, type NomeDimensao } from "../lib/paletas";
import { ic95, num, num1, rotuloPrecisao, sinal } from "../lib/format";
import { edicao } from "../lib/edicoes";
import { useStore } from "../state/store";
import { AvisoProxy } from "./AvisoProxy";
import type { Meta } from "../lib/types";

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
      .then(([d, r]) => { if (vivo) { setDados(d); setRefs(r); } })
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
  if (carregando) return <aside className="painel" aria-label="Painel de detalhes"><p className="muted">{pronto ? "Carregando o fluxo…" : "preparando os dados…"}</p></aside>;

  const ida = dados?.ida ?? null;
  const volta = dados?.volta ?? null;

  if (!ida) {
    return (
      <aside className="painel" aria-label="Painel de detalhes">
        <header className="painel-topo">
          <h2>Fluxo não publicado</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        </header>
        <p className="muted">
          Este par origem–destino ficou abaixo do limiar de divulgação (menos de{" "}
          {meta?.revelacao.min_pessoas ?? 5} pessoas na amostra) e por isso não é
          publicado individualmente.
        </p>
      </aside>
    );
  }

  const saldoPar = ida.total - (volta?.total ?? 0);

  return (
    <aside className="painel" aria-label="Painel de detalhes">
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">
            Fluxo migratório {periodo.de.slice(0, 4)}–{periodo.ate.slice(0, 4)}
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
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      <AvisoProxy meta={meta} />

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-rotulo">Migrantes no fluxo</div>
          <div className="kpi-valor">{num(ida.total)}</div>
          <div className="kpi-detalhe">IC 95%: {ic95(ida.total, ida.se)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Fluxo inverso</div>
          <div className="kpi-valor">{volta ? num(volta.total) : "—"}</div>
          <div className="kpi-detalhe">
            {volta ? `${ida.nm_destino} → ${ida.nm_origem}` : "abaixo do limiar de divulgação"}
          </div>
        </div>
        <div className="kpi kpi-largo">
          <div className="kpi-rotulo">Saldo do par</div>
          <div className="kpi-valor">{sinal(saldoPar)}</div>
          <div className="kpi-detalhe">
            {saldoPar > 0
              ? `${ida.nm_destino} ganha ${num(Math.abs(saldoPar))} pessoas na troca com ${ida.nm_origem}`
              : saldoPar < 0
              ? `${ida.nm_origem} ganha ${num(Math.abs(saldoPar))} pessoas na troca com ${ida.nm_destino}`
              : "troca equilibrada entre os dois municípios"}
          </div>
        </div>
      </div>

      <div className="nota-precisao">
        Precisão: <strong>{rotuloPrecisao[ida.precisao] ?? ida.precisao}</strong>
        {ida.cv != null && <> (coeficiente de variação {num1(ida.cv)}%)</>} ·{" "}
        {ida.n_faixa === "<5" ? "menos de 5" : ida.n_faixa} observações na amostra
      </div>

      {!ida.tem_detalhe ? (
        <p className="aviso">
          O perfil dos migrantes deste fluxo não é publicado: com menos de{" "}
          {meta?.revelacao.min_pessoas_detalhe ?? 20} observações na amostra, o
          detalhamento por característica individualizaria os informantes.
        </p>
      ) : (
        <>
          <h3 className="secao-titulo">Perfil dos migrantes</h3>
          <p className="muted-pequeno explicacao">
            As barras comparam quem fez este percurso com três referências: todos os que
            chegaram ao destino, todos os que saíram da origem e a população residente no destino.
          </p>
          {(["status", "edu", "renda"] as NomeDimensao[])
            .filter((d) => d !== "renda" || temRenda)
            .map((dim) => {
            const series: SeriePerfil[] = [
              { rotulo: "Neste fluxo", valores: doFluxo(ida, dim), destaque: true },
              { rotulo: `Imigrantes de ${ida.nm_destino}`, valores: daReferencia(refs, ida.destino, "imig", dim) },
              { rotulo: `Emigrantes de ${ida.nm_origem}`, valores: daReferencia(refs, ida.origem, "emig", dim) },
            ];
            // status migratório só existe para migrantes: não faz sentido comparar
            // com a população residente, que por definição não migrou no período
            if (dim !== "status") {
              series.push({
                rotulo: `Residentes de ${ida.nm_destino}`,
                valores: daReferencia(refs, ida.destino, "residente", dim),
              });
            }
            return (
              <BarraPerfil key={dim} titulo={DIMENSOES[dim].titulo} nota={DIMENSOES[dim].nota}
                           categorias={DIMENSOES[dim].categorias} series={series} escuro={escuro} />
            );
          })}
          <PiramideIdadeSexo
            titulo="Idade e sexo" rotuloGrupo="Neste fluxo"
            valoresGrupo={colunasLargasDoFluxo(ida, "idade_sexo")}
            rotuloReferencia={`Imigrantes de ${ida.nm_destino}`}
            valoresReferencia={daReferencia(refs, ida.destino, "imig", "idade_sexo")}
            escuro={escuro}
          />
        </>
      )}

      {destinosTrabalho.length > 0 && (
        <>
          <h3 className="secao-titulo">Onde trabalham os que fizeram este percurso</h3>
          <p className="muted-pequeno explicacao">
            Dos migrantes intra-RM que saíram de {ida.nm_origem} e passaram a morar em {ida.nm_destino},
            local de trabalho declarado em {periodo.ate.slice(0, 4)}.
          </p>
          <table className="tabela-fluxos">
            <tbody>
              {destinosTrabalho.map((d, i) => (
                <tr key={i}>
                  <td>
                    {d.nm_destino_trab
                      ? <>{d.nm_destino_trab}<span className="uf">/{d.uf_destino_trab}</span></>
                      : (CLASSE_TRAB as Record<string, { rotulo: string }>)[d.classe_trab]?.rotulo ?? d.classe_trab}
                  </td>
                  <td className="valor-cel">{num(d.total)}</td>
                  <td className="valor-cel muted-pequeno">{d.n_faixa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </aside>
  );
}

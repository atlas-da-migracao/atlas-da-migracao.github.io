/** Painel do fluxo selecionado: volume, precisão, o fluxo reverso e o perfil dos
 *  migrantes daquele par, comparado com três referências. */
import { useEffect, useState } from "react";
import { detalheDoFluxo, referenciasDoPerfil, type DetalheFluxo } from "../db/queries";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { DIMENSOES, type NomeDimensao } from "../lib/paletas";
import { ic95, num, num1, rotuloPrecisao, sinal } from "../lib/format";

interface Props {
  origem: string;
  destino: string;
  escuro: boolean;
  aoFechar: () => void;
  aoAbrirMunicipio: (cd: string) => void;
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

function daReferencia(refs: Refs, cd: string, direcao: string, dim: NomeDimensao): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of refs) {
    if (r.cd_mun === cd && r.direcao === direcao && r.dimensao === dim) out[r.categoria] = r.valor;
  }
  return out;
}

export function PainelFluxo({ origem, destino, escuro, aoFechar, aoAbrirMunicipio }: Props) {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof detalheDoFluxo>> | null>(null);
  const [refs, setRefs] = useState<Refs>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    Promise.all([detalheDoFluxo(origem, destino), referenciasDoPerfil(origem, destino)])
      .then(([d, r]) => { if (vivo) { setDados(d); setRefs(r); } })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [origem, destino]);

  if (carregando) return <aside className="painel"><p className="muted">Carregando o fluxo…</p></aside>;

  const ida = dados?.ida ?? null;
  const volta = dados?.volta ?? null;

  if (!ida) {
    return (
      <aside className="painel">
        <header className="painel-topo">
          <h2>Fluxo não publicado</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        </header>
        <p className="muted">
          Este par origem–destino ficou abaixo do limiar de divulgação (menos de 5 pessoas
          na amostra) e por isso não é publicado individualmente.
        </p>
      </aside>
    );
  }

  const saldoPar = ida.total - (volta?.total ?? 0);

  return (
    <aside className="painel">
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">Fluxo migratório 2017–2022</div>
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
          O perfil dos migrantes deste fluxo não é publicado: com menos de 20 observações
          na amostra, o detalhamento por característica individualizaria os informantes.
        </p>
      ) : (
        <>
          <p className="muted-pequeno explicacao">
            As barras comparam quem fez este percurso com três referências: todos os que
            chegaram ao destino, todos os que saíram da origem e a população residente no destino.
          </p>
          {(["status", "edu", "renda"] as NomeDimensao[]).map((dim) => {
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
        </>
      )}
    </aside>
  );
}

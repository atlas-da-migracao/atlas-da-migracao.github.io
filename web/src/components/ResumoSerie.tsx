/** F12.5 -- Camada 1 ("Ao longo dos censos"): frase-síntese + 3 números com sparkline de 5
 *  pontos, embutida no painel de cada nível (município, unidade agregada, RM, fluxo). Ver
 *  docs/design_serie_censos.md, seções 1.1-1.2. A camada aberta (2/gráficos, 3/tabela) NÃO
 *  mora aqui -- fica em `SerieCensos.tsx`, aberta por `?pagina=serie` (seção completa).
 *
 *  Simplificação assumida nesta fase (documentada no relatório de entrega): o estado de cada
 *  ponto (numero | não existia | sem cobertura | cobertura insuficiente | suprimido) é
 *  derivado aqui das colunas `existia`/`estado_cobertura`/`iem` de `unidades_serie`, em vez de
 *  cruzar com a matriz completa de `comparabilidade.json` medida a medida -- suficiente para
 *  a frase e os 3 números (que usam sempre imig/emig/saldo/iem), insuficiente para decidir o
 *  estado de QUALQUER medida do Bloco 1-4 (isso `SerieCensos.tsx` faz via `estadoDaCelula`).
 */
import { useEffect, useState } from "react";
import { serieDaUnidade, serieFilhosDoMunicipio } from "../db/queries";
import {
  EDICOES_SERIE, NOME_TIPO_IEM, classificarIem, fraseSintese, rotuloEdicao,
  type EdicaoSerie, type EntradaFrase, type NivelSerie, type PontoFrase,
} from "../lib/serie";
import { num, sinal } from "../lib/format";

interface LinhaUnidadeSerie {
  edicao: EdicaoSerie;
  imig: number | null; emig: number | null; saldo: number | null; tlm: number | null;
  iem: number | null; se_iem: number | null; tipo_iem: string | null;
  turnover: number | null;
  existia: boolean; estado_cobertura: string | null;
  cd_mun_mae: string | null; nm_mun_mae: string | null;
}

function estadoDoPonto(l: LinhaUnidadeSerie): PontoFrase["estado"] {
  if (l.existia === false) return "nao_existia";
  if (l.estado_cobertura === "sem_cobertura") return "sem_cobertura";
  if (l.estado_cobertura === "insuficiente") return "cobertura_insuficiente";
  if (l.iem == null) return "suprimido";
  return "numero";
}

function Sparkline({ valores, positivo = true }: { valores: (number | null)[]; positivo?: boolean }) {
  const validos = valores.filter((v): v is number => v != null);
  if (validos.length === 0) return <span className="serie-spark-vazia" aria-hidden />;
  const min = Math.min(0, ...validos);
  const max = Math.max(0, ...validos);
  const span = max - min || 1;
  const w = 60, h = 20, passo = w / (valores.length - 1 || 1);
  const y = (v: number) => h - ((v - min) / span) * h;
  let pontoAtual: { x: number; y: number }[] = [];
  const segmentos: { x: number; y: number }[][] = [];
  valores.forEach((v, i) => {
    if (v == null) {
      if (pontoAtual.length > 0) segmentos.push(pontoAtual);
      pontoAtual = [];
      return;
    }
    pontoAtual.push({ x: i * passo, y: y(v) });
  });
  if (pontoAtual.length > 0) segmentos.push(pontoAtual);
  return (
    <svg className="serie-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {segmentos.map((seg, i) => (
        <polyline key={i} points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={positivo ? "var(--arc-in)" : "currentColor"} strokeWidth={1.5} />
      ))}
      {valores.map((v, i) => v == null ? null : (
        <circle key={i} cx={i * passo} cy={y(v)} r={i === 0 ? 2.6 : 2}
                fill={i === 0 ? "none" : "currentColor"}
                stroke={i === 0 ? "currentColor" : "none"} strokeWidth={i === 0 ? 1.2 : 0} />
      ))}
    </svg>
  );
}

interface Props {
  nivel: NivelSerie;
  codigo: string;
  nome: string;
  /** true quando o município é mãe de algum desmembramento (nota `municipio_mae`, seção 1.2). */
  aoAbrirSerieCompleta: () => void;
  aoAbrirMae?: (cdMae: string) => void;
  /** Subconjunto de edições a exibir (F13) -- default: as cinco, para não quebrar os usos
   *  existentes em `PainelMunicipio`/`PainelUnidade`, que ainda não passam esta prop. */
  edicoes?: readonly EdicaoSerie[];
}

export function ResumoSerie({
  nivel, codigo, nome, aoAbrirSerieCompleta, aoAbrirMae, edicoes = EDICOES_SERIE,
}: Props) {
  const [linhas, setLinhas] = useState<LinhaUnidadeSerie[] | null>(null);
  const [filhos, setFilhos] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    setLinhas(null);
    serieDaUnidade(nivel, codigo).then((r) => {
      if (vivo) setLinhas(r as unknown as LinhaUnidadeSerie[]);
    }).catch(() => { if (vivo) setLinhas([]); });
    if (nivel === "mun") {
      serieFilhosDoMunicipio(codigo).then((r) => {
        if (vivo) setFilhos(r.map((f) => f.codigo));
      }).catch(() => {});
    } else {
      setFilhos([]);
    }
    return () => { vivo = false; };
  }, [nivel, codigo]);

  if (linhas === null) return <p className="muted serie-carregando">Carregando a série…</p>;
  if (linhas.length === 0) return null;

  const porEdicao = new Map(linhas.map((l) => [l.edicao, l]));
  const pontos: PontoFrase[] = edicoes.map((edicao) => {
    const l = porEdicao.get(edicao);
    if (!l) return { edicao, estado: "nao_medido", iem: null, seIem: null, tipo: null,
                      imig: null, emig: null, saldo: null, tlm: null, coberturaPop: null };
    const estado = estadoDoPonto(l);
    return {
      edicao, estado,
      iem: estado === "numero" ? l.iem : null,
      seIem: l.se_iem,
      tipo: estado === "numero" ? classificarIem(l.iem, l.se_iem) : null,
      imig: estado === "numero" ? l.imig : null,
      emig: estado === "numero" ? l.emig : null,
      saldo: estado === "numero" ? l.saldo : null,
      tlm: estado === "numero" ? l.tlm : null,
      coberturaPop: null,
    };
  });

  const primeiraMae = linhas.find((l) => l.cd_mun_mae);
  const entrada: EntradaFrase = {
    nome, nivel, pontos,
    mae: primeiraMae ? {
      nome: primeiraMae.nm_mun_mae ?? primeiraMae.cd_mun_mae!,
      edicoes: linhas.filter((l) => l.cd_mun_mae).map((l) => l.edicao),
      agregada: primeiraMae.cd_mun_mae === "NORTEGO",
    } : undefined,
    filhos: filhos.length > 0 ? { nomes: filhos, ultimaEdicaoJunto: "2010" } : undefined,
  };

  const frase = fraseSintese(entrada);
  const comNumero = pontos.filter((p) => p.estado === "numero");
  const ultima = comNumero[comNumero.length - 1] ?? null;

  return (
    <section className="secao serie-resumo" aria-label="Ao longo dos censos">
      <div className="secao-titulo-linha">
        <h3 className="secao-titulo">Ao longo dos censos</h3>
        <button className="link-serie" onClick={aoAbrirSerieCompleta}>Ver a série completa ↗</button>
      </div>

      <p className="serie-frase">{frase}</p>

      {entrada.mae && aoAbrirMae && (
        <button className="link-serie" onClick={() => aoAbrirMae(entrada.mae!.nome)}>
          Abrir a série de {entrada.mae.nome} ↗
        </button>
      )}

      {ultima && (
        <div className="serie-numeros">
          <div className="serie-numero" role="group" aria-label={`Saldo, ${sinal(ultima.saldo)}`}>
            <div className="serie-numero-rotulo">Saldo ({ultima.edicao})</div>
            <div className="serie-numero-valor">{sinal(ultima.saldo)}</div>
            <Sparkline valores={pontos.map((p) => p.saldo)} />
          </div>
          <div className="serie-numero" role="group"
               aria-label={`Eficácia, ${ultima.tipo ? NOME_TIPO_IEM[ultima.tipo] : "sem classificação"}`}>
            <div className="serie-numero-rotulo">Eficácia ({ultima.edicao})</div>
            <div className="serie-numero-valor">
              {ultima.iem != null ? (ultima.iem > 0 ? "+" : "") + ultima.iem.toFixed(2) : "—"}
            </div>
            <div className="muted-pequeno">{ultima.tipo ? NOME_TIPO_IEM[ultima.tipo] : "sem classificação"}</div>
          </div>
          <div className="serie-numero" role="group" aria-label="Movimento total (entradas + saídas)">
            <div className="serie-numero-rotulo">Movimento total ({ultima.edicao})</div>
            <div className="serie-numero-valor">
              {ultima.imig != null && ultima.emig != null ? num(ultima.imig + ultima.emig) : "—"}
            </div>
            <div className="muted-pequeno">
              entraram {num(ultima.imig)}, saíram {num(ultima.emig)}
            </div>
            <Sparkline valores={pontos.map((p) => (p.imig != null && p.emig != null ? p.imig + p.emig : null))} />
          </div>
        </div>
      )}
      <p className="muted-pequeno serie-legenda-spark">
        {edicoes.map(rotuloEdicao).join(" · ")}
      </p>
    </section>
  );
}

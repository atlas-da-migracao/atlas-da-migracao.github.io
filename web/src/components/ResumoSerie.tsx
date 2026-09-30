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
  EDICOES_SERIE, NOME_TIPO_IEM, filhosNoIntervalo, formatarIem, fraseSintese, geometriaSpark,
  maeDaSerie, pontosDaSerie, rotuloEdicao,
  type EdicaoSerie, type EntradaFrase, type FilhoMunicipio, type LinhaSerieFrase, type NivelSerie,
} from "../lib/serie";
import { num, sinal } from "../lib/format";
import { Termo } from "./Termo";

type LinhaUnidadeSerie = LinhaSerieFrase & { tipo_iem: string | null; turnover: number | null };

const SPARK_W = 64, SPARK_H = 22;

/** Sparkline de uma posição por edição marcada: segmentos só entre pontos contíguos (lacuna =
 *  linha aberta), um ponto em cada valor -- inclusive quando só há um --, marca tracejada nas
 *  posições sem número e losango vazado em 1980 (proxy; o marcador segue a EDIÇÃO, não o índice:
 *  com [1991, 2022] o primeiro ponto é 1991). Geometria em `geometriaSpark` (lib/serie.ts),
 *  a mesma da coluna "tend." da seção completa. */
function Sparkline({ valores, edicoes, positivo = true }: {
  valores: (number | null)[]; edicoes: readonly EdicaoSerie[]; positivo?: boolean;
}) {
  const g = geometriaSpark(valores, SPARK_W, SPARK_H);
  return (
    <svg className="serie-spark" width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden>
      {g.segmentos.map((seg, i) => (
        <polyline key={i} points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={positivo ? "var(--arc-in)" : "currentColor"} strokeWidth={1.5} />
      ))}
      {g.ausentes.map((a) => (
        <rect key={`a${a.i}`} x={a.x - 2} y={SPARK_H / 2 - 4} width={4} height={8} fill="none"
              stroke="var(--ink-muted)" strokeWidth={1} strokeDasharray="1.5 1.5" />
      ))}
      {g.pontos.map((p) => edicoes[p.i] === "1980" ? (
        <polygon key={p.i} fill="var(--plane)" stroke="currentColor" strokeWidth={1.2}
                 points={`${p.x},${p.y - 3.4} ${p.x + 3.4},${p.y} ${p.x},${p.y + 3.4} ${p.x - 3.4},${p.y}`} />
      ) : (
        <circle key={p.i} cx={p.x} cy={p.y} r={2} fill="currentColor" />
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
  /** Recebe o CÓDIGO do município de origem (não o nome). */
  aoAbrirMae?: (cdMae: string) => void;
  /** Subconjunto de edições a exibir (F13) -- default: as cinco, para não quebrar os usos
   *  existentes em `PainelMunicipio`/`PainelUnidade`, que ainda não passam esta prop. */
  edicoes?: readonly EdicaoSerie[];
}

export function ResumoSerie({
  nivel, codigo, nome, aoAbrirSerieCompleta, aoAbrirMae, edicoes = EDICOES_SERIE,
}: Props) {
  // Cada resultado carrega a chave da unidade que o pediu, e só vale se ainda for a unidade
  // atual: ao trocar de município a frase NUNCA sai com as linhas ou os filhos do anterior (nem
  // por um quadro, que é o que um `setFilhos([])` dentro do efeito deixaria passar). `null` =
  // carregando; a frase só é montada com as DUAS consultas da unidade atual terminadas.
  const chave = `${nivel}:${codigo}`;
  const [linhasSt, setLinhasSt] = useState<{ chave: string; linhas: LinhaUnidadeSerie[] } | null>(null);
  const [filhosSt, setFilhosSt] = useState<{ chave: string; filhos: FilhoMunicipio[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    serieDaUnidade(nivel, codigo).then((r) => {
      if (vivo) setLinhasSt({ chave, linhas: r as unknown as LinhaUnidadeSerie[] });
    }).catch(() => { if (vivo) setLinhasSt({ chave, linhas: [] }); });
    if (nivel === "mun") {
      // Contrato: `nome` e `ultima_edicao_ausente` por filho (ver `filhosNoIntervalo`).
      serieFilhosDoMunicipio(codigo).then((r) => {
        if (vivo) setFilhosSt({ chave, filhos: r as unknown as FilhoMunicipio[] });
      }).catch(() => { if (vivo) setFilhosSt({ chave, filhos: [] }); });
    }
    return () => { vivo = false; };
  }, [nivel, codigo, chave]);

  const linhas = linhasSt?.chave === chave ? linhasSt.linhas : null;
  const filhos = nivel !== "mun" ? [] : filhosSt?.chave === chave ? filhosSt.filhos : null;

  if (linhas === null || filhos === null) return <p className="muted serie-carregando">Carregando a série…</p>;
  if (linhas.length === 0) return null;

  const pontos = pontosDaSerie(linhas, edicoes);
  const entrada: EntradaFrase = {
    nome, nivel, pontos,
    // Mãe = a da edição MAIS RECENTE em que a unidade ainda não existia; filhos = só os cuja
    // separação cai dentro das edições marcadas (ver `maeDaSerie`/`filhosNoIntervalo`).
    mae: maeDaSerie(linhas, edicoes),
    filhos: filhosNoIntervalo(filhos, edicoes),
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
        <button className="link-serie" onClick={() => aoAbrirMae(entrada.mae!.codigo ?? entrada.mae!.nome)}>
          Abrir a série de {entrada.mae.nome} ↗
        </button>
      )}

      {ultima && (
        <div className="serie-numeros">
          <div className="serie-numero" role="group" aria-label={`Saldo, ${sinal(ultima.saldo)}`}>
            <div className="serie-numero-rotulo"><Termo chave="saldo">Saldo</Termo> ({ultima.edicao})</div>
            <div className="serie-numero-valor">{sinal(ultima.saldo)}</div>
            <Sparkline valores={pontos.map((p) => p.saldo)} edicoes={edicoes} />
          </div>
          <div className="serie-numero" role="group"
               aria-label={`Eficácia, ${ultima.tipo ? NOME_TIPO_IEM[ultima.tipo] : "sem classificação"}`}>
            <div className="serie-numero-rotulo"><Termo chave="eficacia_iem">Eficácia</Termo> ({ultima.edicao})</div>
            <div className="serie-numero-valor">
              {formatarIem(ultima.iem)}
            </div>
            <div className="muted-pequeno">{ultima.tipo ? NOME_TIPO_IEM[ultima.tipo] : "sem classificação"}</div>
            <Sparkline valores={pontos.map((p) => p.iem)} edicoes={edicoes} />
          </div>
          <div className="serie-numero" role="group" aria-label="Movimento total (entradas + saídas)">
            <div className="serie-numero-rotulo"><Termo chave="rotatividade">Movimento total</Termo> ({ultima.edicao})</div>
            <div className="serie-numero-valor">
              {ultima.imig != null && ultima.emig != null ? num(ultima.imig + ultima.emig) : "—"}
            </div>
            <div className="muted-pequeno">
              entraram {num(ultima.imig)}, saíram {num(ultima.emig)}
            </div>
            <Sparkline valores={pontos.map((p) => (p.imig != null && p.emig != null ? p.imig + p.emig : null))} edicoes={edicoes} />
          </div>
        </div>
      )}
      <p className="muted-pequeno serie-legenda-spark">
        {edicoes.map(rotuloEdicao).join(" · ")}
      </p>
    </section>
  );
}

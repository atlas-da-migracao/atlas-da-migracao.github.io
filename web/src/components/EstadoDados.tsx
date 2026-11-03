/** F6: indicador da carga a frio do DuckDB.
 *
 *  O mapa pinta em ~1 s a partir de municipios_mapa.json, mas arcos e painéis dependem
 *  do DuckDB-WASM (baixar o motor, instanciar, registrar as views) -- historicamente
 *  5-6 s sem nenhum sinal. Esta barra fina, fixa abaixo do cabeçalho, mostra a etapa
 *  atual e some quando pronto; em erro, reaparece com um botão para tentar de novo. */
import { useEffect, useState } from "react";
import { conectar, ouvirProgresso, type ProgressoDuckDB } from "../db/duckdb";
import { useStore } from "../state/store";
import { useT, type Dicionario } from "../i18n";

/** `db/duckdb.ts` emite a mensagem de cada etapa já em português; aqui ela é reconhecida e
 *  traduzida (as que não são conhecidas passam como vieram). */
function mensagemDaEtapa(mensagem: string, d: Dicionario): string {
  const e = d.controles.estadoDados.etapas;
  if (mensagem === "baixando o motor…") return e.baixando;
  if (mensagem === "baixando o motor de consulta…") return e.baixandoMotor;
  if (mensagem === "iniciando o banco…") return e.iniciando;
  const m = /^registrando tabelas (\d+)\/(\d+)$/.exec(mensagem);
  return m ? e.registrando(m[1], m[2]) : mensagem;
}

export function EstadoDados() {
  const d = useT();
  const censo = useStore((s) => s.censo);
  const [p, setP] = useState<ProgressoDuckDB | null>(null);

  useEffect(() => {
    setP(null);
    return ouvirProgresso(setP, censo);
  }, [censo]);

  if (!p || p.estagio === "pronto") return null;

  return (
    <div className={`estado-dados${p.estagio === "erro" ? " erro" : ""}`} role="status" aria-live="polite">
      {p.estagio !== "erro" ? (
        <>
          <span className="estado-dados-spinner" aria-hidden="true" />
          <span>{d.controles.estadoDados.preparando(mensagemDaEtapa(p.mensagem, d))}</span>
        </>
      ) : (
        <>
          <span>{d.controles.estadoDados.falha(p.erro ?? null)}</span>
          <button onClick={() => { setP(null); conectar(censo).catch(() => {}); }}>
            {d.controles.estadoDados.tentarDeNovo}
          </button>
        </>
      )}
    </div>
  );
}

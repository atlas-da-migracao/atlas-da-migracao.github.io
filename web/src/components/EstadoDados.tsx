/** F6: indicador da carga a frio do DuckDB.
 *
 *  O mapa pinta em ~1 s a partir de municipios_mapa.json, mas arcos e painéis dependem
 *  do DuckDB-WASM (baixar o motor, instanciar, registrar as views) -- historicamente
 *  5-6 s sem nenhum sinal. Esta barra fina, fixa abaixo do cabeçalho, mostra a etapa
 *  atual e some quando pronto; em erro, reaparece com um botão para tentar de novo. */
import { useEffect, useState } from "react";
import { conectar, ouvirProgresso, type ProgressoDuckDB } from "../db/duckdb";
import { useStore } from "../state/store";

export function EstadoDados() {
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
          <span>Preparando os dados… {p.mensagem}</span>
        </>
      ) : (
        <>
          <span>Não foi possível preparar os dados{p.erro ? `: ${p.erro}` : "."}</span>
          <button onClick={() => { setP(null); conectar(censo).catch(() => {}); }}>
            tentar de novo
          </button>
        </>
      )}
    </div>
  );
}

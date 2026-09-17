/** F13.4 -- chips de marcar/desmarcar edições no modo "Ao longo dos censos". Sem estado
 *  interno: `marcadas` vem do store (`edicoesSerie`) e `aoMudar` grava de volta. */
import { EDICOES_SERIE, MIN_EDICOES_SERIE, alternarEdicao, rotuloEdicao, type EdicaoSerie } from "../lib/serie";

export function SeletorEdicoes({ marcadas, aoMudar }: {
  marcadas: readonly EdicaoSerie[]; aoMudar: (eds: EdicaoSerie[]) => void;
}) {
  return (
    <div className="segmentado segmentado-edicoes" role="group" aria-label="Censos comparados (marque de 2 a 5)">
      {EDICOES_SERIE.map((e) => {
        const marcada = marcadas.includes(e);
        const desabilitado = marcada && marcadas.length <= MIN_EDICOES_SERIE;
        return (
          <button
            key={e}
            className={marcada ? "ativo" : ""}
            aria-pressed={marcada}
            disabled={desabilitado}
            title={desabilitado ? "Marque pelo menos duas edições" : undefined}
            onClick={() => aoMudar(alternarEdicao(marcadas, e))}
          >
            {rotuloEdicao(e)}
          </button>
        );
      })}
    </div>
  );
}

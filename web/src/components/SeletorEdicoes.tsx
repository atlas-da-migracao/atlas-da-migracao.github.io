/** F13.4 -- chips de marcar/desmarcar edições no modo "Ao longo dos censos". Sem estado
 *  interno: `marcadas` vem do store (`edicoesSerie`) e `aoMudar` grava de volta. */
import { useT } from "../i18n";
import { EDICOES_SERIE, MIN_EDICOES_SERIE, alternarEdicao, rotuloEdicao, type EdicaoSerie } from "../lib/serie";

export function SeletorEdicoes({ marcadas, aoMudar }: {
  marcadas: readonly EdicaoSerie[]; aoMudar: (eds: EdicaoSerie[]) => void;
}) {
  const d = useT();
  return (
    <div className="segmentado segmentado-edicoes" role="group" aria-label={d.serie.seletor.aria}>
      {EDICOES_SERIE.map((e) => {
        const marcada = marcadas.includes(e);
        const desabilitado = marcada && marcadas.length <= MIN_EDICOES_SERIE;
        return (
          <button
            key={e}
            className={marcada ? "ativo" : ""}
            aria-pressed={marcada}
            disabled={desabilitado}
            title={desabilitado ? d.serie.seletor.minimoDuas : undefined}
            onClick={() => aoMudar(alternarEdicao(marcadas, e))}
          >
            {rotuloEdicao(e, d)}
          </button>
        );
      })}
    </div>
  );
}

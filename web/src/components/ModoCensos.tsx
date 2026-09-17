/** F13.4 -- aba "Ao longo dos censos": busca unificada (5 níveis) + seletor de edições +
 *  a seção completa (`SerieCensos`), sem chrome de overlay (era `?pagina=serie`, F12.5). */
import { useEffect, useMemo, useState } from "react";
import { Busca, type ItemBusca } from "./Busca";
import { SeletorEdicoes } from "./SeletorEdicoes";
import { SerieCensos, ROTULO_NIVEL } from "./SerieCensos";
import { serieUnidadesParaBusca, type UnidadeBusca } from "../db/queries";
import { lerUnidadeSerie } from "../state/url";
import { useStore } from "../state/store";

export function ModoCensos({ escuro, aoAbrirMetodologia }: {
  escuro: boolean; aoAbrirMetodologia: () => void;
}) {
  const { unidadeSerie, edicoesSerie, setUnidadeSerie, setEdicoesSerie } = useStore();
  const [unidades, setUnidades] = useState<UnidadeBusca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    serieUnidadesParaBusca()
      .then((r) => { if (vivo) setUnidades(r); })
      .catch((e: unknown) => { if (vivo) setErro((e as Error).message); });
    return () => { vivo = false; };
  }, []);

  const itens: ItemBusca[] = useMemo(() => {
    if (!unidades) return [];
    return unidades.map((u): ItemBusca => {
      const rotulo = u.nivel === "mun" && u.uf_sigla ? `${u.nome}/${u.uf_sigla}` : u.nome;
      const detalheNivel = ROTULO_NIVEL[u.nivel];
      const detalhe = (u.nivel === "rgi" || u.nivel === "rgint") && u.uf_sigla
        ? `${detalheNivel} · ${u.uf_sigla}` : detalheNivel;
      return { codigo: `${u.nivel}:${u.codigo}`, rotulo, detalhe, peso: u.peso };
    });
  }, [unidades]);

  const aoEscolher = (chave: string) => setUnidadeSerie(lerUnidadeSerie(chave));

  const unidadeAtual = unidadeSerie && unidades
    ? unidades.find((u) => u.nivel === unidadeSerie.nivel && u.codigo === unidadeSerie.codigo) ?? null
    : null;
  const nome = unidadeAtual
    ? (unidadeAtual.nivel === "mun" && unidadeAtual.uf_sigla
        ? `${unidadeAtual.nome}/${unidadeAtual.uf_sigla}` : unidadeAtual.nome)
    : null;
  const naoEncontrada = Boolean(unidadeSerie) && unidades != null && !unidadeAtual;

  return (
    <main className="conteudo modo-censos" id="conteudo-principal">
      <div className="modo-censos-topo" role="toolbar" aria-label="Território e censos comparados">
        <Busca itens={itens} placeholder="Buscar município, região, UF ou RM…" aoEscolher={aoEscolher} />
        <SeletorEdicoes marcadas={edicoesSerie} aoMudar={setEdicoesSerie} />
        {unidadeSerie && nome && (
          <div className="modo-censos-unidade">
            <span className="muted-pequeno">{ROTULO_NIVEL[unidadeSerie.nivel]}</span>
            <h2>{nome}</h2>
          </div>
        )}
      </div>
      <div className="modo-censos-corpo">
        {erro ? (
          <p className="erro" role="alert">Falha ao carregar as unidades: {erro}</p>
        ) : !unidadeSerie ? (
          <section className="modo-censos-vazio">
            <h2>Compare um território ao longo dos censos</h2>
            <p>
              Escolha um município, uma região imediata ou intermediária, uma UF ou uma região
              metropolitana para ver como a migração mudou entre 1980 e 2022.
            </p>
            <Busca itens={itens} placeholder="Buscar município, região, UF ou RM…" aoEscolher={aoEscolher} />
          </section>
        ) : naoEncontrada ? (
          <section className="modo-censos-vazio">
            <h2>Esta unidade não existe na base territorial de 2022</h2>
            <button className="link-serie" onClick={() => setUnidadeSerie(null)}>Escolher outra</button>
          </section>
        ) : unidadeAtual && nome ? (
          <SerieCensos
            key={`${unidadeSerie.nivel}:${unidadeSerie.codigo}`}
            nivel={unidadeSerie.nivel} codigo={unidadeSerie.codigo} nome={nome} escuro={escuro}
            edicoes={edicoesSerie} aoAbrirMetodologia={aoAbrirMetodologia}
          />
        ) : (
          <p className="muted">Carregando…</p>
        )}
      </div>
    </main>
  );
}

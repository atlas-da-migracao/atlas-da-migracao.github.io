/** F13.4 -- aba "Ao longo dos censos": busca unificada (5 níveis) + seletor de edições +
 *  a seção completa (`SerieCensos`), sem chrome de overlay (era `?pagina=serie`, F12.5). */
import { useEffect, useMemo, useState } from "react";
import { Busca, type ItemBusca } from "./Busca";
import { SeletorEdicoes } from "./SeletorEdicoes";
import { SerieCensos } from "./SerieCensos";
import { useT } from "../i18n";
import { serieUnidadesParaBusca, type UnidadeBusca } from "../db/queries";
import { lerUnidadeSerie } from "../state/url";
import { useStore } from "../state/store";

export function ModoCensos({ escuro, aoAbrirMetodologia }: {
  escuro: boolean; aoAbrirMetodologia: () => void;
}) {
  const d = useT();
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
      const detalheNivel = d.comum.niveis[u.nivel].singular;
      const detalhe = (u.nivel === "rgi" || u.nivel === "rgint") && u.uf_sigla
        ? `${detalheNivel} · ${u.uf_sigla}` : detalheNivel;
      return { codigo: `${u.nivel}:${u.codigo}`, rotulo, detalhe, peso: u.peso };
    });
  }, [unidades, d]);

  const aoEscolher = (chave: string) => setUnidadeSerie(lerUnidadeSerie(chave));

  const unidadeAtual = unidadeSerie && unidades
    ? unidades.find((u) => u.nivel === unidadeSerie.nivel && u.codigo === unidadeSerie.codigo) ?? null
    : null;
  const nome = unidadeAtual
    ? (unidadeAtual.nivel === "mun" && unidadeAtual.uf_sigla
        ? `${unidadeAtual.nome}/${unidadeAtual.uf_sigla}` : unidadeAtual.nome)
    : null;
  const naoEncontrada = Boolean(unidadeSerie) && unidades != null && !unidadeAtual;
  // `naoEncontrada`: o código da URL (ex.: um link antigo) não corresponde a nenhuma unidade da
  // base territorial de 2022, que é a que a série usa. Sem beco sem saída: o painel oferece
  // voltar à busca.

  return (
    <main className="conteudo modo-censos" id="conteudo-principal">
      <div className="modo-censos-topo" role="toolbar" aria-label={d.serie.modo.aria}>
        <Busca itens={itens} placeholder={d.serie.modo.placeholderBusca} aoEscolher={aoEscolher} />
        <SeletorEdicoes marcadas={edicoesSerie} aoMudar={setEdicoesSerie} />
        {unidadeSerie && nome && (
          <div className="modo-censos-unidade">
            <span className="muted-pequeno">{d.comum.niveis[unidadeSerie.nivel].singular}</span>
            <h2>{nome}</h2>
          </div>
        )}
      </div>
      <div className="modo-censos-corpo">
        {erro ? (
          <p className="erro" role="alert">{d.serie.modo.falhaUnidades(erro)}</p>
        ) : !unidadeSerie ? (
          <section className="modo-censos-vazio">
            <h2>{d.serie.modo.vazioTitulo}</h2>
            <p>{d.serie.modo.vazioTexto}</p>
            <Busca itens={itens} placeholder={d.serie.modo.placeholderBusca} aoEscolher={aoEscolher} />
          </section>
        ) : naoEncontrada ? (
          <section className="modo-censos-vazio">
            <h2>{d.serie.modo.naoEncontradaTitulo}</h2>
            <p>
              {d.serie.modo.naoEncontradaTexto.antes}<code>{unidadeSerie.codigo}</code>{d.serie.modo.naoEncontradaTexto.depois}
            </p>
            <button className="link-serie" onClick={() => setUnidadeSerie(null)}>{d.serie.modo.voltarBusca}</button>
          </section>
        ) : unidadeAtual && nome ? (
          <SerieCensos
            key={`${unidadeSerie.nivel}:${unidadeSerie.codigo}`}
            nivel={unidadeSerie.nivel} codigo={unidadeSerie.codigo} nome={nome} escuro={escuro}
            edicoes={edicoesSerie} aoAbrirMetodologia={aoAbrirMetodologia}
          />
        ) : (
          <p className="muted">{d.comum.ui.carregando}</p>
        )}
      </div>
    </main>
  );
}

/** Ponto de entrada da página de metodologia: escolhe a versão do idioma ativo.
 *
 *  O português (pt.tsx, a versão de referência) vem no bundle; inglês, francês e espanhol são
 *  carregados sob demanda (`React.lazy`), como os dicionários de i18n/index.ts -- quem nunca
 *  troca de idioma não baixa ~3 x 30 kB de prosa. O idioma é o de `useIdioma()` (o dicionário
 *  efetivamente aplicado), e não `useStore().lang`, para o texto e a formatação de números
 *  (`localeNumeros()`, trocada junto com o dicionário) nunca ficarem em idiomas diferentes.
 *
 *  API pública: `Metodologia({ meta })` (components/PaginaMetodologia.tsx e testes). O título
 *  e o botão de fechar da página vêm de `useRotulosPagina()`, em ./comum (importado de lá
 *  direto: este arquivo só exporta componentes, por causa do fast refresh). */
import { lazy, Suspense, type ComponentType } from "react";
import { useIdioma, useT, type Lang } from "../../i18n";
import { MetodologiaPt } from "./pt";
import type { PropsMetodologia } from "./comum";

export type { PropsMetodologia } from "./comum";

const TRADUCOES: Record<Exclude<Lang, "pt-BR">, ComponentType<PropsMetodologia>> = {
  en: lazy(() => import("./en").then((m) => ({ default: m.MetodologiaEn }))),
  fr: lazy(() => import("./fr").then((m) => ({ default: m.MetodologiaFr }))),
  es: lazy(() => import("./es").then((m) => ({ default: m.MetodologiaEs }))),
};

export function Metodologia({ meta }: PropsMetodologia) {
  const lang = useIdioma();
  const d = useT();
  if (lang === "pt-BR") return <MetodologiaPt meta={meta} />;
  const Traducao = TRADUCOES[lang];
  return (
    <Suspense
      fallback={
        <div className="metodologia-conteudo">
          <p className="muted" role="status">{d.comum.ui.carregando}</p>
        </div>
      }
    >
      <Traducao meta={meta} />
    </Suspense>
  );
}

/** Seletor de idioma do cabeçalho (PT · EN · FR · ES). O rótulo acessível do grupo é fixo e
 *  bilíngue (quem caiu num idioma que não lê precisa achar o controle), e cada botão leva o
 *  nome do idioma no próprio idioma, com `lang` para o leitor de tela pronunciar certo. */
import { useStore } from "../state/store";
import { IDIOMAS, ROTULO_IDIOMA } from "../i18n/tipos";

export function SeletorIdioma() {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  return (
    <div className="segmentado segmentado-idioma" role="group" aria-label="Idioma · Language">
      {IDIOMAS.map((l) => (
        <button key={l} lang={l} className={lang === l ? "ativo" : ""} aria-pressed={lang === l}
                title={ROTULO_IDIOMA[l].nome} aria-label={ROTULO_IDIOMA[l].nome}
                onClick={() => setLang(l)}>
          {ROTULO_IDIOMA[l].curto}
        </button>
      ))}
    </div>
  );
}

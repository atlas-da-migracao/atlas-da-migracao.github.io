/** F6: página de metodologia, como painel de página inteira sobre o mapa (?pagina=metodologia).
 *  Fecha com o botão ou Esc; foco vai para o botão de fechar ao abrir e volta ao gatilho ao sair. */
import { useEffect, useRef } from "react";
import { Metodologia } from "../conteudo/metodologia";
import type { Meta } from "../lib/types";

export function PaginaMetodologia({ meta, aoFechar }: { meta: Meta | null; aoFechar: () => void }) {
  const fecharRef = useRef<HTMLButtonElement>(null);
  const gatilho = useRef<Element | null>(null);

  useEffect(() => {
    gatilho.current = document.activeElement;
    fecharRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      (gatilho.current as HTMLElement | null)?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pagina-cheia" role="dialog" aria-modal="true" aria-labelledby="metodologia-titulo">
      <header className="pagina-cheia-topo">
        <h2 id="metodologia-titulo">Metodologia</h2>
        <button ref={fecharRef} className="fechar" onClick={aoFechar} aria-label="Fechar metodologia">×</button>
      </header>
      <div className="pagina-cheia-corpo">
        <Metodologia meta={meta} />
      </div>
    </div>
  );
}

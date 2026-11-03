/** F6: tour de boas-vindas -- coach marks ancorados em elementos reais da interface,
 *  via `data-tour="<passo>"`. Sem biblioteca externa: posiciona um cartão ao lado do
 *  elemento (getBoundingClientRect) e um recorte translúcido por cima do resto da tela.
 *
 *  Aparece sozinho na primeira visita (localStorage `tour_visto`); o botão "Como usar"
 *  no cabeçalho reabre a qualquer momento. */
import { useEffect, useRef, useState } from "react";
import { marcarTourVisto } from "../lib/tour";
import { useT } from "../i18n";

interface Passo { alvo: string; chave: "mapa" | "busca" | "metrica" | "painel" | "modoRm" | "modoCensos" }

/** `alvo` é um seletor CSS resolvido com document.querySelector -- em geral um
 *  atributo `data-tour="..."` posto no elemento real da interface, mas ".painel"
 *  para o painel de detalhes reaproveita a classe que os quatro painéis já usam. */
const PASSOS: Passo[] = [
  { alvo: '[data-tour="mapa"]', chave: "mapa" },
  { alvo: '[data-tour="busca"]', chave: "busca" },
  { alvo: '[data-tour="metrica"]', chave: "metrica" },
  { alvo: ".painel", chave: "painel" },
  { alvo: '[data-tour="modo-rm"]', chave: "modoRm" },
  { alvo: '[data-tour="modo-censos"]', chave: "modoCensos" },
];

interface Props { aoFechar: () => void }

export function Tour({ aoFechar }: Props) {
  const d = useT();
  const [passo, setPasso] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const gatilho = useRef<Element | null>(null);

  useEffect(() => { gatilho.current = document.activeElement; }, []);

  // recalcula a posição do alvo a cada passo (e ao redimensionar/rolar)
  useEffect(() => {
    const atualizar = () => {
      const el = document.querySelector(PASSOS[passo].alvo);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    atualizar();
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);
    return () => {
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
    };
  }, [passo]);

  useEffect(() => {
    cartaoRef.current?.focus();
  }, [passo]);

  const encerrar = () => {
    marcarTourVisto();
    aoFechar();
    (gatilho.current as HTMLElement | null)?.focus?.();
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); encerrar(); }
    if (e.key === "ArrowRight" && passo < PASSOS.length - 1) setPasso((p) => p + 1);
    if (e.key === "ArrowLeft" && passo > 0) setPasso((p) => p - 1);
  };

  const p = d.tour.passos[PASSOS[passo].chave];
  const ultimo = passo === PASSOS.length - 1;

  // posição do cartão: abaixo do alvo, com fallback para o centro da tela se o alvo sumiu
  const estiloCartao: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: Math.min(rect.bottom + 12, window.innerHeight - 220),
        left: Math.min(Math.max(rect.left, 12), window.innerWidth - 340),
      }
    : { position: "fixed", top: "40%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="tour-camada" onKeyDown={aoTeclar}>
      {rect && (
        <div
          className="tour-realce"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div
        ref={cartaoRef}
        className="tour-cartao"
        style={estiloCartao}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-texto"
        tabIndex={-1}
      >
        <div className="tour-passo-contagem">{d.tour.contagem(passo + 1, PASSOS.length)}</div>
        <h3 id="tour-titulo">{p.titulo}</h3>
        <p id="tour-texto">{p.texto}</p>
        <div className="tour-acoes">
          <button className="tour-pular" onClick={encerrar}>{d.tour.pular}</button>
          <div className="tour-nav">
            {passo > 0 && <button onClick={() => setPasso((v) => v - 1)}>{d.tour.voltar}</button>}
            {!ultimo
              ? <button className="tour-primario" onClick={() => setPasso((v) => v + 1)}>{d.tour.proximo}</button>
              : <button className="tour-primario" onClick={encerrar}>{d.tour.concluir}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

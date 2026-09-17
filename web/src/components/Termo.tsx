/** Tooltip explicativo reutilizável: envolve um rótulo já existente com um botão "ⓘ" que abre
 *  um popover com a definição/interpretação/limitações do termo, lidas de `lib/glossario.ts`.
 *
 *  Abre ao clicar OU focar o botão (não só hover -- precisa funcionar em touch e teclado);
 *  fecha com Escape, clique fora, ou blur do botão (a menos que o foco tenha ido para dentro
 *  do próprio popover). Posicionamento automático (`posicionar`): mede o popover já montado
 *  (altura variável conforme o texto) e escolhe abrir abaixo ou acima do botão -- o que tiver
 *  mais espaço --, sempre clampado à viewport nas duas direções, para nunca ficar cortado pela
 *  borda da tela. Recalcula em resize/scroll enquanto aberto. */
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { termo } from "../lib/glossario";

const MARGEM_VIEWPORT = 8;

interface Props {
  /** Chave de `GLOSSARIO`. Se não existir, renderiza só `children`, sem o ícone. */
  chave: string;
  /** Rótulo visível (o texto do KPI/coluna/label) -- nunca alterado pelo componente. Opcional
   *  para o caso de o ícone precisar ficar como irmão de outro elemento clicável (nunca dentro
   *  dele -- <button> dentro de <button> é HTML inválido), ex.: ao lado de um cabeçalho de
   *  coluna ordenável em `ComparativoRM.tsx`. */
  children?: React.ReactNode;
  className?: string;
}

export function Termo({ chave, children, className }: Props) {
  const def = termo(chave);
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!def && chave) {
      // eslint-disable-next-line no-console
      console.warn(`Termo: chave "${chave}" não existe em GLOSSARIO`);
    }
  }, [def, chave]);

  // Mede o popover já montado (altura variável conforme o texto) e escolhe abrir acima ou
  // abaixo do botão -- o lado com mais espaço --, sempre clampado à viewport; roda antes da
  // pintura do navegador, então não há flash na posição inicial.
  const posicionar = () => {
    const botao = botaoRef.current;
    const popover = popoverRef.current;
    if (!botao || !popover) return;
    const rBotao = botao.getBoundingClientRect();
    const altura = popover.offsetHeight;
    const largura = popover.offsetWidth;
    const espacoAbaixo = window.innerHeight - rBotao.bottom;
    const espacoAcima = rBotao.top;
    const abrirAcima = espacoAbaixo < altura + MARGEM_VIEWPORT && espacoAcima > espacoAbaixo;
    const top = abrirAcima
      ? Math.max(MARGEM_VIEWPORT, rBotao.top - altura - 6)
      : Math.min(rBotao.bottom + 6, window.innerHeight - altura - MARGEM_VIEWPORT);
    const left = Math.min(
      Math.max(rBotao.left + rBotao.width / 2 - largura / 2, MARGEM_VIEWPORT),
      window.innerWidth - largura - MARGEM_VIEWPORT,
    );
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!aberto) { setPos(null); return; }
    posicionar();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setAberto(false); botaoRef.current?.focus(); }
    };
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (botaoRef.current?.contains(alvo) || popoverRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!def) return <>{children}</>;

  const aoPerderFoco = (e: React.FocusEvent) => {
    const proximo = e.relatedTarget as Node | null;
    if (proximo && popoverRef.current?.contains(proximo)) return;
    if (proximo && botaoRef.current?.contains(proximo)) return;
    setAberto(false);
  };

  const tituloId = `termo-titulo-${chave}`;

  // Enquanto `pos` não foi medido (primeiro layout do popover recém-montado), fica invisível
  // no canto para não piscar numa posição errada -- `posicionar()` corrige antes da pintura.
  const estiloPopover: React.CSSProperties = pos
    ? { position: "fixed", top: pos.top, left: pos.left }
    : { position: "fixed", top: 0, left: 0, visibility: "hidden" };

  return (
    <span className={className ? `termo ${className}` : "termo"}>
      {children}
      <button
        ref={botaoRef}
        type="button"
        className="termo-botao"
        aria-label={`O que é ${def.termo}`}
        aria-expanded={aberto}
        // onClick e onFocus both abrem (nunca fecham): um clique dispara focus + click em
        // sequência (dois eventos distintos, não plotados no mesmo batch do React), e um
        // onClick que alternasse fecharia o popover no mesmo clique que o abriu. Fechar é
        // sempre Escape, clique fora, ou blur -- nunca um clique repetido no próprio ícone.
        onClick={() => setAberto(true)}
        onFocus={() => setAberto(true)}
        onBlur={aoPerderFoco}
      >
        ⓘ
      </button>
      {aberto && createPortal(
        // Portal para <body>: o ícone aparece dentro de tabelas com `overflow: auto`
        // (ex. `.tabela-scroll`), e um `position: fixed` dentro de um ancestral com
        // overflow != visible é clipado/deslocado pelo Chromium em vez de flutuar sobre
        // a página inteira -- só escapa desse recorte renderizando fora da árvore.
        <div
          ref={popoverRef}
          className="termo-popover"
          role="dialog"
          aria-labelledby={tituloId}
          style={estiloPopover}
        >
          <div id={tituloId} className="termo-popover-titulo">{def.termo}</div>
          <div className="termo-popover-secao">
            <strong>O que é</strong>
            <p>{def.definicao}</p>
          </div>
          <div className="termo-popover-secao">
            <strong>Como interpretar</strong>
            <p>{def.interpretacao}</p>
          </div>
          {def.limitacoes && (
            <div className="termo-popover-secao">
              <strong>Limitações</strong>
              <p>{def.limitacoes}</p>
            </div>
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}

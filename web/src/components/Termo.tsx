/** Tooltip explicativo reutilizável: envolve um rótulo já existente com um botão "ⓘ" que abre
 *  um popover com a definição/interpretação/limitações do termo, lidas de `lib/glossario.ts`.
 *
 *  Abre ao clicar OU focar o botão (não só hover -- precisa funcionar em touch e teclado);
 *  fecha com Escape, clique fora, ou blur do botão (a menos que o foco tenha ido para dentro
 *  do próprio popover). Reaproveita a técnica de posicionamento de `Tour.tsx`
 *  (getBoundingClientRect + clamp simples à viewport), sem posicionamento "inteligente". */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { termo } from "../lib/glossario";

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
  const [rect, setRect] = useState<DOMRect | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!def && chave) {
      // eslint-disable-next-line no-console
      console.warn(`Termo: chave "${chave}" não existe em GLOSSARIO`);
    }
  }, [def, chave]);

  useEffect(() => {
    if (!aberto) return;
    const el = botaoRef.current;
    setRect(el ? el.getBoundingClientRect() : null);

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
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicarFora);
    };
  }, [aberto]);

  if (!def) return <>{children}</>;

  const aoPerderFoco = (e: React.FocusEvent) => {
    const proximo = e.relatedTarget as Node | null;
    if (proximo && popoverRef.current?.contains(proximo)) return;
    if (proximo && botaoRef.current?.contains(proximo)) return;
    setAberto(false);
  };

  const tituloId = `termo-titulo-${chave}`;

  const estiloPopover: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: Math.min(rect.bottom + 6, window.innerHeight - 40),
        left: Math.min(Math.max(rect.left - 140, 8), window.innerWidth - 304),
      }
    : { position: "fixed", top: "40%", left: "50%", transform: "translate(-50%, -50%)" };

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

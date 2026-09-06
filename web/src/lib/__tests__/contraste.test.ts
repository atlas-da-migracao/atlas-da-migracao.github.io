/** F6 leva 2: garante que os tokens de texto pequeno (< 18px) mantêm contraste WCAG
 *  1.4.3 (>= 4,5:1) contra as superfícies em que aparecem, nos dois temas.
 *
 *  Lê os valores diretamente de styles/tokens.css (em vez de duplicar os hexes aqui)
 *  para que qualquer alteração futura de token seja validada automaticamente. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(aqui, "../../styles/tokens.css"), "utf-8");

/** Extrai as declarações "--token: #hex;" de um bloco { ... } específico. */
function tokensDoBloco(fonte: string, marcador: string): Record<string, string> {
  const inicio = fonte.indexOf(marcador);
  if (inicio === -1) throw new Error(`bloco não encontrado: ${marcador}`);
  const abre = fonte.indexOf("{", inicio);
  let profundidade = 1;
  let i = abre + 1;
  while (profundidade > 0 && i < fonte.length) {
    if (fonte[i] === "{") profundidade++;
    else if (fonte[i] === "}") profundidade--;
    i++;
  }
  const bloco = fonte.slice(abre + 1, i - 1);
  const out: Record<string, string> = {};
  for (const m of bloco.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const CLARO = tokensDoBloco(css, ":root {");
const ESCURO = tokensDoBloco(css, '[data-theme="dark"] {');

function srgb(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
/** Razão de contraste WCAG entre duas cores (1 a 21). */
function contraste(a: string, b: string): number {
  const l1 = luminancia(a), l2 = luminancia(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const LIMIAR = 4.5;

// pares token de texto x superfície em que o token efetivamente aparece (ver app.css:
// .kpi-rotulo, .kpi-detalhe, .muted-pequeno, .muted, .legenda-nota, .perfil-rotulo etc.)
const SUPERFICIES = ["surface", "plane", "surface-raised"];
const TEXTOS = ["ink-muted-texto", "ink-secondary", "ink"];

describe("contraste dos tokens de texto (WCAG 1.4.3, >= 4.5:1)", () => {
  for (const [nomeTema, tema] of [["claro", CLARO], ["escuro", ESCURO]] as const) {
    for (const textoTok of TEXTOS) {
      for (const supTok of SUPERFICIES) {
        it(`${nomeTema}: --${textoTok} sobre --${supTok}`, () => {
          const texto = tema[textoTok];
          const superficie = tema[supTok];
          expect(texto, `token --${textoTok} não encontrado no tema ${nomeTema}`).toBeDefined();
          expect(superficie, `token --${supTok} não encontrado no tema ${nomeTema}`).toBeDefined();
          const razao = contraste(texto, superficie);
          expect(razao).toBeGreaterThanOrEqual(LIMIAR);
        });
      }
    }
  }

  it("--acento-ativo e --acento-erro têm >= 4.5:1 com texto branco (botão ativo, banner de erro)", () => {
    for (const [nomeTema, tema] of [["claro", CLARO], ["escuro", ESCURO]] as const) {
      for (const tok of ["acento-ativo", "acento-erro"]) {
        const cor = tema[tok] ?? CLARO[tok]; // --acento-erro só está declarado em :root
        expect(cor, `${tok} (${nomeTema})`).toBeDefined();
        expect(contraste(cor, "#ffffff"), `${tok} (${nomeTema}) x branco`).toBeGreaterThanOrEqual(LIMIAR);
      }
    }
  });

  it("--ink-muted NÃO é usado como texto pequeno (documentação do risco: falha o limiar)", () => {
    // --ink-muted é reservado a traços/ícones/separadores (ver comentário em tokens.css);
    // este teste documenta por que ele foi banido de texto, não é uma regressão esperada.
    const razao = contraste(CLARO["ink-muted"], CLARO["surface"]);
    expect(razao).toBeLessThan(LIMIAR);
  });
});

/** Utilidades de contraste WCAG (cálculo de luminância relativa e razão de contraste),
 *  compartilhadas entre a suíte de testes de tokens e os componentes que escolhem a cor
 *  do texto sobre um fundo variável (ex.: rótulos de segmento sobre a paleta categórica
 *  em BarraPerfil -- o fundo muda por categoria/tema, então a cor do texto não pode ser
 *  fixa em CSS sem risco de ficar abaixo de 4,5:1 em alguns segmentos). */

function srgb(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

/** Razão de contraste WCAG entre duas cores hex (1 a 21). */
export function contraste(a: string, b: string): number {
  const l1 = luminancia(a), l2 = luminancia(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Preto ou branco, o que tiver mais contraste contra `fundo` -- para rótulos desenhados
 *  em cima de uma cor de dado que varia por categoria/tema (a paleta é protegida, então o
 *  texto tem que se adaptar a ela, não o contrário). */
export function corTextoLegivel(fundo: string): "#000000" | "#ffffff" {
  return contraste(fundo, "#ffffff") >= contraste(fundo, "#000000") ? "#ffffff" : "#000000";
}

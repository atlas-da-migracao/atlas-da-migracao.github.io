/** Renderiza uma frase do dicionário que tem trechos em negrito marcados com `**` -- as
 *  funções de `i18n/pt/*.ts` devolvem só `string` (são dados puros), e quem escolhe a ordem das
 *  palavras e o que fica em destaque em cada idioma é a própria frase. */
export function TextoRico({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("**").map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte))}
    </>
  );
}

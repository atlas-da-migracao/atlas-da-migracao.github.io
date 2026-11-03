import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { useStore } from "./state/store";
import { aplicarIdioma } from "./i18n";

// Em idioma diferente do português, espera o dicionário (carregado sob demanda) antes da
// primeira pintura -- senão a tela piscaria em português.
const lang = useStore.getState().lang;
void (lang === "pt-BR" ? Promise.resolve() : aplicarIdioma(lang)).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

// O rodapé estático de index.html (fora de #root, para rastreadores sem JS) é substituído pelo
// rodapé do app: sem isto ele rolava para dentro da tela abaixo do atlas, sempre com "Censo 2022"
// e sem acompanhar o tema. As páginas de SEO geradas por pipeline/build_paginas.py têm
// template próprio e não dependem dele.
document.getElementById("rodape-estatico")?.remove();

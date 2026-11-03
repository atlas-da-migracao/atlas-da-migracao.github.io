/** `i18n/dados.json` traduz a prosa que vem dos dados publicados. A tradução só vale enquanto o
 *  texto PT de `origem` for idêntico ao que o pipeline publica -- este teste acusa a divergência
 *  (o pipeline mudou um aviso e a tradução ficou velha) e a lacuna (texto novo sem tradução).
 *  Lê só `data/processed` (agregado público, versionado); pula se a pasta não existir. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import dados from "../dados.json";
import { definirDadosParaTeste, textoDado, type EntradaDado } from "../dados";

const PROCESSED = resolve(__dirname, "../../../../data/processed");
const tabela = dados as Record<string, EntradaDado>;
const CENSOS = ["2022", "2010", "2000", "1991", "1980"];
const CAMPOS = ["aviso", "fonte", "aviso_proxy", "aviso_proxy_resumo", "aviso_pendular_estudo"];

const ler = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const metaDe = (censo: string) =>
  ler(censo === "2022" ? `${PROCESSED}/meta.json` : `${PROCESSED}/${censo}/meta.json`);

/** Toda prosa publicada que a interface exibe, como pares chave -> texto PT atual. */
function prosaPublicada(): Map<string, string> {
  const m = new Map<string, string>();
  for (const censo of CENSOS) {
    const meta = metaDe(censo);
    for (const campo of CAMPOS) if (meta[campo]) m.set(`${campo}.${censo}`, meta[campo]);
    for (const u of meta.ufs_fora_da_epoca ?? []) m.set(`nota_uf.${censo}.${u.uf}`, u.nota);
    for (const u of meta.unidades_agregadas ?? []) m.set(`unidade_agregada.${censo}.${u.codigo}`, u.nota);
  }
  const comp = ler(`${PROCESSED}/series/comparabilidade.json`);
  for (const [k, v] of Object.entries(comp.notas ?? {})) m.set(`notas.${k}`, v as string);
  return m;
}

describe.skipIf(!existsSync(`${PROCESSED}/meta.json`))("dados.json contra data/processed", () => {
  const publicada = prosaPublicada();

  it("toda prosa publicada tem tradução", () => {
    const faltando = [...publicada.keys()].filter((k) => !tabela[k]);
    expect(faltando).toEqual([]);
  });

  it("o texto de origem de cada tradução é o texto publicado hoje", () => {
    const divergentes = [...publicada].filter(([k, v]) => tabela[k] && tabela[k].origem !== v)
      .map(([k]) => k);
    expect(divergentes).toEqual([]);
  });
});

describe("textoDado", () => {
  afterEach(() => definirDadosParaTeste(null, "pt-BR"));
  const t = { "aviso.2022": { origem: "Olá", en: "Hello", fr: "Bonjour", es: "Hola" } };

  it("traduz quando a origem confere", () => {
    definirDadosParaTeste(t, "fr");
    expect(textoDado("aviso.2022", "Olá")).toBe("Bonjour");
  });

  it("devolve o português quando a origem mudou, a chave falta ou o idioma é pt", () => {
    definirDadosParaTeste(t, "en");
    expect(textoDado("aviso.2022", "Olá de novo")).toBe("Olá de novo");
    expect(textoDado("aviso.1980", "Oi")).toBe("Oi");
    expect(textoDado("aviso.1980", null)).toBeNull();
    definirDadosParaTeste(t, "pt-BR");
    expect(textoDado("aviso.2022", "Olá")).toBe("Olá");
  });

  it("nenhuma tradução vazia", () => {
    const vazias = Object.entries(tabela)
      .filter(([, e]) => !e.en?.trim() || !e.fr?.trim() || !e.es?.trim()).map(([k]) => k);
    expect(vazias).toEqual([]);
  });
});

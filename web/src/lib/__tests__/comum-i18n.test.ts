import { describe, expect, it } from "vitest";
import { pt } from "../../i18n/pt";
import {
  DIMENSOES, DIMENSOES_PENDULAR, FAIXAS_IDADE, CLASSE_TRAB, CLASSE_ESTUDO, TIPOLOGIA_INTRA_RM,
  categoriaOutros, dimensao, dimensaoPendular, rotuloCategoria, rotuloClasseEstudo, rotuloClasseTrab,
  rotuloFaixaIdade, rotuloRecorte, tipologiaIntraRM,
} from "../paletas";
import { CENSOS, edicao, rotuloCenso, rotuloRetornoCenso, subtituloCenso } from "../edicoes";
import { faixasLegenda, legendaMedidaSerie } from "../escalas";
import { rotuloPrecisao } from "../format";
import { REGIAO_ORDEM, rotuloRegiao } from "../uf";
import { CHAVES_GLOSSARIO, termo } from "../glossario";
import { prepararSankey } from "../rm";

describe("textos compartilhados no dicionário (pt)", () => {
  it("toda categoria declarada em paletas.ts tem rótulo em comum.categorias (nenhuma cai na chave)", () => {
    const grupos: [string, readonly { chave: string; rotulo: string }[]][] = [
      ...Object.entries(DIMENSOES).map(([n, d]) => [n, d.categorias] as [string, readonly { chave: string; rotulo: string }[]]),
      ...Object.entries(DIMENSOES_PENDULAR).map(([n, d]) => [n, d.categorias] as [string, readonly { chave: string; rotulo: string }[]]),
      ["tipologia", TIPOLOGIA_INTRA_RM.categorias],
      ["faixasIdade", FAIXAS_IDADE],
    ];
    for (const [grupo, cats] of grupos) {
      for (const c of cats) {
        const r = rotuloCategoria(grupo as never, c.chave, pt);
        expect(r, `${grupo}.${c.chave}`).toBe(c.rotulo);
        expect(r).not.toBe(c.chave);
      }
    }
    for (const k of Object.keys(CLASSE_TRAB)) expect(rotuloClasseTrab(k)).toBe(CLASSE_TRAB[k as keyof typeof CLASSE_TRAB].rotulo);
    for (const k of Object.keys(CLASSE_ESTUDO)) expect(rotuloClasseEstudo(k)).toBe(CLASSE_ESTUDO[k as keyof typeof CLASSE_ESTUDO].rotulo);
    expect(rotuloFaixaIdade("60_mais")).toBe("60 ou mais");
  });

  it("dimensao()/dimensaoPendular()/tipologiaIntraRM() devolvem título, nota e categorias", () => {
    expect(dimensao("edu").titulo).toBe("Escolaridade");
    expect(dimensao("edu").nota).toBe("pessoas de 25 anos ou mais");
    expect(dimensao("status").nota).toBeNull();
    expect(dimensaoPendular("tempo2010").nota).toBe("só quem retorna para casa diariamente");
    expect(dimensaoPendular("modo").categorias.find((c) => c.chave === "outros")?.rotulo).toBe("Outros meios ou suprimido");
    expect(tipologiaIntraRM().titulo).toBe("Tipologia do fluxo");
    // as cores não mudam com o idioma
    expect(dimensao("renda").categorias[0].cor).toEqual(DIMENSOES.renda.categorias[0].cor);
  });

  it("rotuloRecorte e categoriaOutros", () => {
    expect(rotuloRecorte("edu__superior_completo")).toBe("Superior completo");
    expect(rotuloRecorte("chave_desconhecida")).toBe("chave_desconhecida");
    expect(categoriaOutros().rotulo).toBe("Outros ou suprimido");
  });

  it("edições: acessos com dicionário, iguais aos campos em português", () => {
    for (const c of CENSOS) {
      expect(rotuloCenso(c)).toBe(edicao(c).rotulo);
      expect(subtituloCenso(c)).toBe(edicao(c).subtitulo);
      expect(rotuloRetornoCenso(c)).toBe(edicao(c).rotuloRetorno);
    }
    expect(rotuloCenso("1980")).toBe("Censo 1980");
  });

  it("faixas da legenda: frases em português, números do idioma ativo", () => {
    const f = faixasLegenda([5, 20, 50.5], "‰");
    expect(f.map((x) => x.rotulo)).toEqual([
      "ganho acima de 50,5‰", "20 a 50,5‰", "5 a 20‰", "baixa variação (±5‰)",
      "5 a 20‰", "20 a 50,5‰", "perda acima de 50,5‰",
    ]);
    expect(faixasLegenda([1000.4, 2000, 3000], "")[0].rotulo).toBe("ganho acima de 3.000");
  });

  it("legenda do mapa comparativo: um texto por slot de cor", () => {
    expect(legendaMedidaSerie("iem")).toHaveLength(7);
    expect(legendaMedidaSerie("tlm")[3]).toEqual({ cor: "zero", rotulo: "quase equilíbrio (±10‰)" });
    expect(legendaMedidaSerie("tbe")).toHaveLength(5);
  });

  it("precisão, regiões e nós residuais do Sankey", () => {
    expect(rotuloPrecisao("cautela")).toBe("usar com cautela");
    expect(rotuloPrecisao("outra")).toBe("outra");
    expect(REGIAO_ORDEM.map((r) => rotuloRegiao(r))).toEqual([...REGIAO_ORDEM]);
    const s = prepararSankey(
      [{ origem_mig: "1", destino_mig: "2", destino_trab: "3", classe_trab: "origem", total: 10, n_faixa: "10-19" },
       { origem_mig: "4", destino_mig: "5", destino_trab: "6", classe_trab: "nucleo", total: 5, n_faixa: "5-9" }] as never,
      new Map(), 1,
    );
    expect(s.caminhos.at(-1)?.trabalho).toBe("Outros municípios");
  });

  it("níveis territoriais: todas as formas para os 5 níveis", () => {
    expect(pt.comum.niveis.rgi.plural).toBe("regiões imediatas");
    expect(pt.comum.niveis.uf.artigoDef).toBe("a UF");
    expect(pt.comum.niveis.mun.ver).toBe("Ver o município");
    expect(pt.comum.niveis.rgint.curto).toBe("Reg. intermediária");
    expect(pt.comum.niveis.rm.par).toBe("as duas regiões metropolitanas");
  });

  it("glossário: 37 termos no dicionário, com termo/definicao/interpretacao", () => {
    expect(CHAVES_GLOSSARIO).toHaveLength(37);
    for (const k of CHAVES_GLOSSARIO) {
      const t = termo(k);
      expect(t?.termo && t.definicao && t.interpretacao, k).toBeTruthy();
    }
    expect(termo("saldo")?.termo).toBe("Saldo migratório");
    expect(termo("nao_existe")).toBeUndefined();
  });
});

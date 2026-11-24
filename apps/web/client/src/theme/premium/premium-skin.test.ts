import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PREMIUM_SKIN_STORAGE_KEY,
  isPremiumSkinEnabled,
  premiumSkinAttribute,
} from "./flag";
import {
  buildPremiumSkinCss,
  contrastRatio,
  premiumAliasMap,
  premiumContrastPairs,
  premiumFontAliases,
  premiumTokens,
} from "./tokens";

const read = (file: string) => readFileSync(file, "utf8");
const skinCss = read("client/src/theme/premium/premium-skin.css");

function sourceFiles(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry);
    if (statSync(file).isDirectory()) sourceFiles(file, out);
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\./.test(entry))
      out.push(file);
  }
  return out;
}

describe("Premium tokens", () => {
  it("defines the same tokens in both themes", () => {
    expect(Object.keys(premiumTokens.light).sort()).toEqual(
      Object.keys(premiumTokens.dark).sort()
    );
  });

  for (const theme of ["dark", "light"] as const) {
    it.each(premiumContrastPairs)(
      `${theme}: %s on %s reaches %s:1 (WCAG AA)`,
      (fg, bg, minimum) => {
        expect(
          contrastRatio(premiumTokens[theme][fg], premiumTokens[theme][bg])
        ).toBeGreaterThanOrEqual(minimum);
      }
    );
  }

  it("never puts white text on the brand orange (2.87:1)", () => {
    for (const theme of ["dark", "light"] as const) {
      expect(premiumTokens[theme]["--nx-on-brand"].toLowerCase()).not.toBe(
        "#ffffff"
      );
      expect(
        contrastRatio("#ffffff", premiumTokens[theme]["--nx-brand"])
      ).toBeLessThan(4.5);
    }
  });

  it("documents that light brand orange is a fill, not a standalone mark", () => {
    // #ff6a01 on white is 2.87:1: icons, active markers and links use --nx-brand-text.
    expect(
      contrastRatio(
        premiumTokens.light["--nx-brand"],
        premiumTokens.light["--nx-surface"]
      )
    ).toBeLessThan(3);
    expect(premiumAliasMap["--accent"]).toBe("--nx-brand-text");
    expect(premiumAliasMap["--accent-text"]).toBe("--nx-brand-text");
  });

  it("maps every alias to an existing Premium token", () => {
    for (const [alias, token] of Object.entries(premiumAliasMap)) {
      expect(premiumTokens.light, alias).toHaveProperty(token);
    }
  });

  it("only re-points aliases that the current app actually uses", () => {
    const corpus = sourceFiles("client/src")
      .filter(
        file => !file.includes(`${path.sep}theme${path.sep}premium${path.sep}`)
      )
      .map(read)
      .join("\n");
    for (const alias of [
      ...Object.keys(premiumAliasMap),
      ...premiumFontAliases,
    ]) {
      expect(corpus, alias).toContain(`${alias}`);
      expect(new RegExp(`var\\(${alias}[,)]`).test(corpus), alias).toBe(true);
    }
  });

  it("keeps the existing alias names (compatibility: no renames)", () => {
    const index = read("client/src/index.css");
    const undeclared = Object.keys(premiumAliasMap).filter(
      alias => !new RegExp(`${alias}:`).test(index)
    );
    // Used by pages but never declared today (they fall back); Premium gives them a value.
    expect(undeclared.sort()).toEqual([
      "--surface-primary",
      "--surface-subtle",
    ]);
  });
});

describe("Premium skin CSS", () => {
  it("is generated from tokens.ts (CSS ↔ TS parity)", () => {
    expect(skinCss).toBe(buildPremiumSkinCss());
  });

  it('only matches when data-skin="premium" is present', () => {
    const selectors = skinCss
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .match(/[^{}]+(?=\{)/g)!
      .flatMap(selector => selector.split(","))
      .map(selector => selector.trim())
      .filter(Boolean);
    expect(selectors).toHaveLength(4);
    for (const selector of selectors) {
      expect(selector).toMatch(/^(:root|\.app-root)\[data-skin="premium"\]/);
    }
  });

  it("is unlayered and declares only custom properties and color-scheme", () => {
    expect(skinCss.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /@layer|@import|@media|!important/
    );
    const declarations = skinCss
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .match(/\{([^}]*)\}/g)!
      .flatMap(body => body.slice(1, -1).split(";"))
      .map(line => line.trim())
      .filter(Boolean);
    for (const declaration of declarations) {
      expect(declaration, declaration).toMatch(/^(--[a-z0-9-]+|color-scheme):/);
    }
  });

  it("is loaded after index.css so equal-specificity rules resolve to Premium", () => {
    const main = read("client/src/main.tsx");
    const index = main.indexOf('import "./index.css";');
    const skin = main.indexOf('import "./theme/premium/premium-skin.css";');
    expect(index).toBeGreaterThan(-1);
    expect(skin).toBeGreaterThan(index);
  });

  it("uses DM Sans, which index.css already loads", () => {
    expect(read("client/src/index.css")).toMatch(
      /fonts\.googleapis\.com\/css2\?family=DM\+Sans/
    );
    expect(skinCss).toMatch(/--nx-font: "DM Sans"/);
  });
});

describe("Premium skin flag (default OFF)", () => {
  const storage = (value: string | null) => ({ getItem: () => value });

  it("is off in production builds, even with the localStorage override", () => {
    expect(isPremiumSkinEnabled({ DEV: false }, storage("on"))).toBe(false);
    expect(
      isPremiumSkinEnabled(
        { DEV: false, VITE_PREMIUM_SKIN: "false" },
        storage("on")
      )
    ).toBe(false);
  });

  it("is off in development without an explicit opt-in", () => {
    expect(isPremiumSkinEnabled({ DEV: true }, storage(null))).toBe(false);
    expect(isPremiumSkinEnabled({ DEV: true }, null)).toBe(false);
    expect(
      isPremiumSkinEnabled(
        { DEV: true },
        {
          getItem: () => {
            throw new Error("blocked");
          },
        }
      )
    ).toBe(false);
  });

  it("turns on only by explicit opt-in", () => {
    expect(isPremiumSkinEnabled({ DEV: true }, storage("on"))).toBe(true);
    expect(
      isPremiumSkinEnabled({ DEV: false, VITE_PREMIUM_SKIN: "true" }, null)
    ).toBe(true);
    expect(PREMIUM_SKIN_STORAGE_KEY).toBe("nexo:premium-skin");
  });

  it("does not set data-skin when off (DOM unchanged)", () => {
    expect(premiumSkinAttribute(false)).toBeUndefined();
    expect(premiumSkinAttribute(true)).toBe("premium");
  });

  it("is not set by any env file or build script", () => {
    for (const file of readdirSync(".").filter(entry =>
      /^\.env|^package\.json$|^vite\.config/.test(entry)
    )) {
      expect(read(file), file).not.toMatch(/VITE_PREMIUM_SKIN\s*=\s*["']?true/);
    }
  });

  it("cannot be injected into deploy builds (Dockerfiles and workflows never pass it)", () => {
    // Docker only forwards platform variables (e.g. Railway) that are declared as ARG/ENV.
    const deployFiles = [
      ...readdirSync(".").filter(entry => /^Dockerfile/.test(entry)),
      ...readdirSync("../../.github/workflows").map(
        entry => `../../.github/workflows/${entry}`
      ),
    ];
    expect(deployFiles).toContain("Dockerfile.railway");
    for (const file of deployFiles) {
      expect(read(file), file).not.toMatch(/PREMIUM_SKIN/);
    }
  });

  it("is applied by MainLayout only, through the flag", () => {
    const layout = read("client/src/components/MainLayout.tsx");
    expect(layout).toMatch(/const premiumSkin = isPremiumSkinEnabled\(\);/);
    expect(layout).toMatch(/useDocumentPremiumSkin\(premiumSkin\);/);
    expect(layout).toMatch(/data-skin=\{premiumSkinAttribute\(premiumSkin\)\}/);
    const writers = sourceFiles("client/src").filter(file =>
      /data-skin|dataset\.skin/.test(read(file))
    );
    expect(writers.sort()).toEqual(
      [
        path.join("client", "src", "components", "MainLayout.tsx"),
        path.join("client", "src", "theme", "premium", "flag.ts"),
        path.join("client", "src", "theme", "premium", "premium-skin.css"),
        path.join("client", "src", "theme", "premium", "tokens.ts"),
      ].sort()
    );
  });
});

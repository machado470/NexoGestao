import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => mobile.value }));

import { ResponsiveDetails } from "./ResponsiveDetails";

function render(props: { controls?: boolean } = {}) {
  return renderToStaticMarkup(
    <ResponsiveDetails title="Mais filtros" {...props}>
      <select aria-label="Responsável" />
      <select aria-label="Prazo" />
    </ResponsiveDetails>
  );
}

describe("ResponsiveDetails", () => {
  beforeEach(() => {
    mobile.value = false;
  });

  it("on desktop exposes the children directly to the parent layout", () => {
    const html = render({ controls: true });
    expect(html).toBe(
      '<div class="contents" data-responsive-details="Mais filtros">' +
        '<select aria-label="Responsável"></select><select aria-label="Prazo"></select>' +
        "</div>"
    );
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<summary");
  });

  it("on mobile keeps a collapsed disclosure with a visible summary", () => {
    mobile.value = true;
    const html = render({ controls: true });
    expect(html).toMatch(/^<details class="min-w-0 w-full" data-responsive-details="Mais filtros">/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain(
      '<summary class="min-h-11 cursor-pointer py-2 text-sm font-semibold">Mais filtros</summary>'
    );
    expect(html).toContain('<div class="grid min-w-0 gap-3"><select aria-label="Responsável">');
  });

  it("keeps the bordered card variant on mobile", () => {
    mobile.value = true;
    expect(render()).toMatch(
      /^<details class="min-w-0 rounded-xl border border-\[var\(--border-subtle\)\] p-3"/
    );
  });

  it("does not rely on display: contents on a <details> element", () => {
    const source = readFileSync("client/src/components/ResponsiveDetails.tsx", "utf8");
    expect(source).not.toContain("md:contents");
  });

  it("keeps the search field usable when filters share its row", () => {
    // With filters inline on desktop, a flex-1 search would shrink to ~30px
    // instead of letting the toolbar wrap.
    for (const [file, id] of [
      ["client/src/pages/ServiceOrdersPage.tsx", "service-order-search"],
      ["client/src/pages/PeoplePage.tsx", "people-search"],
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(
        new RegExp(`<div className="min-w-0 flex-1 md:min-w-\\[16rem\\]">\\s*<label[^>]*htmlFor="${id}"`)
      );
    }
  });
});

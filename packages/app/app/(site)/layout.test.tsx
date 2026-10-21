import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SiteLayout, { metadata } from "./layout";

// Root layouts render <html>, which can't mount inside a test container; render to markup.
describe("site root layout", () => {
  it("renders the document with DaisyUI body classes around the page", () => {
    const html = renderToStaticMarkup(
      <SiteLayout params={Promise.resolve({})}>
        <p>page</p>
      </SiteLayout>,
    );

    expect(html).toMatch(/^<html lang="en">/);
    expect(html).toMatch(/<body class="[^"]*bg-base-100[^"]*"><p>page<\/p><\/body>/);
    expect(metadata.title).toBe("WP Autonomy Studio");
  });
});

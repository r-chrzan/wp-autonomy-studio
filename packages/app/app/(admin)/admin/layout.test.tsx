import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdminLayout, { metadata } from "./layout";

// Root layouts render <html>, which can't mount inside a test container; render to markup.
describe("admin root layout", () => {
  it("renders the document around the page with the admin title template", () => {
    const html = renderToStaticMarkup(
      <AdminLayout params={Promise.resolve({})}>
        <p>page</p>
      </AdminLayout>,
    );

    expect(html).toMatch(/^<html lang="en">/);
    expect(html).toMatch(/<body class="[^"]*antialiased[^"]*"><p>page<\/p><\/body>/);
    expect(metadata.title).toMatchObject({ template: "%s · Admin · WP Autonomy Studio" });
  });
});

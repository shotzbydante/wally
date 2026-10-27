import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_AGENT, decodeEntities, jsonLdMenu, menuLinks, menuish, pageText, readSiteMenu, readableSite, robotsAllow } from "./menu-site";

afterEach(() => vi.unstubAllGlobals());

describe("what may be read", () => {
  it("reads a restaurant's own site, never a marketplace or an ordering platform's page", () => {
    expect(readableSite("https://www.tacoselgordo.com/menu")).toBe(true);
    expect(readableSite("https://www.doordash.com/store/tacos")).toBe(false);
    expect(readableSite("https://order.toasttab.com/online/tacos")).toBe(false);
    expect(readableSite("https://tacos-el-gordo.square.site")).toBe(false);
    expect(readableSite("https://www.instagram.com/tacos")).toBe(false);
    expect(readableSite("ftp://tacos.example/menu")).toBe(false);
    expect(readableSite(null)).toBe(false);
  });
  it("follows robots.txt: our own rules first, then everyone's, longest rule winning", () => {
    const robots = "User-agent: *\nDisallow: /private/\nAllow: /private/menu\n\nUser-agent: WallyBot\nDisallow: /menu\n";
    expect(robotsAllow(robots, "/menu")).toBe(false);
    expect(robotsAllow(robots, "/about")).toBe(true);
    expect(robotsAllow(robots, "/private/menu", "otherbot")).toBe(true);
    expect(robotsAllow(robots, "/private/x", "otherbot")).toBe(false);
    expect(robotsAllow("User-agent: *\nDisallow: /", "/menu")).toBe(false);
    expect(robotsAllow("User-agent: *\nDisallow:\n", "/menu")).toBe(true);
    expect(robotsAllow("", "/menu")).toBe(true);
  });
});

describe("reading a page", () => {
  const html = `<html><head><title>Gino's</title><script>var x=1</script><style>p{}</style></head><body>
    <nav><a href="/menu">Menu</a><a href="/about">About</a></nav>
    <h1>Gino&#39;s Pizza &amp; Pasta</h1>
    <div class="item"><h3>Margherita</h3><p>Tomato, mozzarella, basil</p><span>$14.00</span></div>
    <div class="item"><h3>Lasagna</h3><p>Beef ragu, b&eacute;chamel</p><span>$18</span></div>
    <p>Follow us on Instagram</p>
    <a href="/files/dinner-menu.pdf">Dinner menu (PDF)</a>
    <a href="https://www.doordash.com/store/ginos">Order on DoorDash</a>
    <a href="mailto:hi@ginos.example">Email</a>
    <footer>© Gino's</footer>
  </body></html>`;

  it("keeps the words and drops the scripts, styles and site furniture", () => {
    const text = pageText(html);
    expect(text).toContain("Gino's Pizza & Pasta");
    expect(text).toContain("Margherita\nTomato, mozzarella, basil\n$14.00");
    expect(text).toContain("béchamel");
    expect(text).not.toContain("var x=1");
    expect(text).not.toContain("About");
    expect(text).not.toContain("©");
    expect(decodeEntities("&lt;b&gt; &#x41; &nbsp;x")).toBe("<b> A  x");
  });
  it("keeps the lines around prices when a page has many, and the whole page when it hasn't", () => {
    const text = "Welcome\nMargherita\n$14\nLasagna\n$18\nTiramisu\n$9\nPenne\n$16\nSalad\n$11\nWine\n$12\nHours 5-10\nParking in back";
    const kept = menuish(text);
    expect(kept).toContain("Margherita\n$14");
    expect(kept).not.toContain("Parking");
    expect(menuish("Welcome\nMargherita\n$14\nHours")).toBe("Welcome\nMargherita\n$14\nHours");
  });
  it("finds the menu pages on the same site and the PDF menus, and leaves other sites alone", () => {
    const links = menuLinks(html, "https://ginos.example/");
    expect(links.pages).toEqual(["https://ginos.example/menu"]);
    expect(links.pdfs).toEqual(["https://ginos.example/files/dinner-menu.pdf"]);
  });
  it("reads the menu a site publishes as structured data", () => {
    const ld = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: "Gino's",
      hasMenu: {
        "@type": "Menu",
        hasMenuSection: [
          { "@type": "MenuSection", name: "Pizza", hasMenuItem: [{ "@type": "MenuItem", name: "Margherita", description: "Tomato, mozzarella, basil", offers: { "@type": "Offer", price: "14.00", priceCurrency: "USD" } }] },
          { "@type": "MenuSection", name: "Pasta", hasMenuItem: [{ "@type": "MenuItem", name: "Lasagna", offers: { "@type": "Offer", price: 18 } }, { "@type": "MenuItem", name: "Lasagna" }] },
        ],
      },
    })}</script><script type="application/ld+json">not json</script>`;
    expect(jsonLdMenu(ld)).toEqual([
      { name: "Margherita", description: "Tomato, mozzarella, basil", price: "$14.00", section: "Pizza" },
      { name: "Lasagna", price: "$18", section: "Pasta" },
    ]);
    expect(jsonLdMenu("<p>no data</p>")).toEqual([]);
  });

  it("reads a site: robots first, then the home page, then its menu pages, as itself", async () => {
    const calls: { url: string; ua: string | undefined }[] = [];
    const pages: Record<string, string> = {
      "https://ginos.example/robots.txt": "User-agent: *\nDisallow: /private/",
      "https://ginos.example/": html,
      "https://ginos.example/menu": `<html><body><h2>Pizza</h2><p>Margherita $14</p><p>Diavola $16</p><p>Funghi $15</p><h2>Pasta</h2><p>Lasagna $18</p><p>Penne $16</p><p>Gnocchi $17</p></body></html>`,
    };
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, ua: (init.headers as Record<string, string>)["User-Agent"] });
      const body = pages[url];
      return new Response(body ?? "", { status: body ? 200 : 404, headers: { "content-type": url.endsWith("robots.txt") ? "text/plain" : "text/html" } });
    });
    const menu = await readSiteMenu("https://ginos.example/");
    expect(calls.map((c) => c.url)).toEqual(["https://ginos.example/robots.txt", "https://ginos.example/", "https://ginos.example/menu"]);
    expect(calls.every((c) => c.ua === USER_AGENT)).toBe(true);
    expect(menu).toMatchObject({ source: "https://ginos.example/menu", pages: 2, pdfs: ["https://ginos.example/files/dinner-menu.pdf"] });
    expect(menu!.text.startsWith("[https://ginos.example/menu]\nPizza\nMargherita $14")).toBe(true);
    expect(menu!.text).toContain("[https://ginos.example/]");
  });
  it("stops at robots.txt, and at a site it may not read", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return new Response("User-agent: *\nDisallow: /", { status: 200, headers: { "content-type": "text/plain" } });
    });
    expect(await readSiteMenu("https://ginos.example/")).toBeNull();
    expect(calls).toEqual(["https://ginos.example/robots.txt"]);
    expect(await readSiteMenu("https://www.doordash.com/store/ginos")).toBeNull();
    expect(calls).toHaveLength(1);
  });
  it("is null when the site has nothing menu-like", async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(url.endsWith("robots.txt") ? "" : "<html><body><p>Welcome to our law office.</p></body></html>", { status: 200, headers: { "content-type": url.endsWith("robots.txt") ? "text/plain" : "text/html" } }));
    expect(await readSiteMenu("https://law.example/")).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_AGENT, decodeEntities, jsonLdMenu, menuLinks, menuScore, menuish, pageText, readSiteMenu, readableSite, robotsAllow, sectionCount, stripFurniture } from "./menu-site";

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
  it("ranks the links: Menu first, food words next, ordering and single-location pages last, each page once", () => {
    const page = `<a href="/locations/">Locations</a><a href="/locations/madison/">Madison</a><a href="/delivery">Order &amp; Delivery</a><a href="/delivery/">Delivery</a>
      <a href="/drinks">Drinks</a><a href="/our-menu/">Our Menu</a><a href="/shop">Shop</a><a href="/product/tee">Tee</a><a href="/">Home</a><a href="/escaped#menu">Top</a>`;
    expect(menuLinks(page, "https://goat.example/").pages).toEqual(["https://goat.example/our-menu", "https://goat.example/drinks", "https://goat.example/locations/madison", "https://goat.example/delivery"]);
  });
  it("knows a menu by its section headings when it prints no prices, and tells it from a merchandise page", () => {
    const madison = "Billy Goat on Madison\nHours\nBreakfast Plates\nSteak & Eggs\nFamous Burgers\nCheezborger\nHot Sandwiches\nItalian Beef\nSides\nFries\nDrinks\nCoffee or Tea";
    expect(sectionCount(madison)).toBeGreaterThanOrEqual(5);
    expect(menuScore(madison, "https://goat.example/locations/madison/")).toBeGreaterThan(menuScore("Official merchandise\nT-Shirt\n$19.95\nOrnament\n$15.99\nBeer Glass\n$12.95", "https://goat.example/"));
    expect(menuScore("Welcome to our law office.", "https://law.example/")).toBe(0);
    expect(menuScore("Fries $4", "https://x.example/menu/")).toBeGreaterThanOrEqual(8);
  });
  it("drops furniture: social and cart lines, and lines every one of three pages repeats, but keeps a menu two pages share", () => {
    const menu = "Burgers\nCheezborger\nFries";
    const [a, b, c] = stripFurniture([`Facebook\nAPPLY FOR A JOB\n0 Items\nWelcome\n${menu}`, `Facebook\nAPPLY FOR A JOB\n0 Items\nHours\n${menu}`, "Facebook\nAPPLY FOR A JOB\n0 Items\nOur story"]);
    expect(a).toBe(`Welcome\n${menu}`);
    expect(b).toBe(`Hours\n${menu}`);
    expect(c).toBe("Our story");
    expect(stripFurniture(["Instagram\nFries $4", "Instagram\nFries $4"])).toEqual(["Fries $4", "Fries $4"]);
  });
  it("treats markup a page shows escaped as markup", () => {
    expect(pageText("<p>&lt;h2&gt;Food&lt;/h2&gt; &lt;p&gt;Fries&lt;/p&gt;</p>")).toBe("Food Fries");
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
  it("finds a priceless menu on a location page, past the home page's merchandise", async () => {
    const furniture = "<p>Facebook</p><p>APPLY FOR A JOB</p>";
    const pages: Record<string, string> = {
      "https://goat.example/": `<html><body>${furniture}<a href="/delivery/">Order &amp; Delivery</a><a href="/locations/madison/">Madison</a><a href="/locations/pier/">Pier</a><h2>Merch</h2><p>T-Shirt $19.95</p><p>Ornament $15.99</p><p>Glass $12.95</p></body></html>`,
      "https://goat.example/delivery": `<html><body>${furniture}<p>Order through our partners.</p></body></html>`,
      "https://goat.example/locations/madison": `<html><body>${furniture}<h2>Famous Burgers</h2><p>Cheezborger</p><p>Double Cheezborger</p><h2>Hot Sandwiches</h2><p>Italian Beef</p><h2>Sides</h2><p>Fries</p><h2>Drinks</h2><p>Coffee</p></body></html>`,
      "https://goat.example/locations/pier": `<html><body>${furniture}<p>Seats 50.</p></body></html>`,
    };
    vi.stubGlobal("fetch", async (url: string) => new Response(pages[url] ?? "", { status: pages[url] ? 200 : 404, headers: { "content-type": url.endsWith("robots.txt") ? "text/plain" : "text/html" } }));
    const menu = await readSiteMenu("https://goat.example/");
    expect(menu).toMatchObject({ source: "https://goat.example/locations/madison", pages: 4 });
    expect(menu!.text.startsWith("[https://goat.example/locations/madison]\nFamous Burgers\nCheezborger")).toBe(true);
    expect(menu!.text).not.toContain("Facebook");
  });
  it("is null when the site has nothing menu-like", async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(url.endsWith("robots.txt") ? "" : "<html><body><p>Welcome to our law office.</p></body></html>", { status: 200, headers: { "content-type": url.endsWith("robots.txt") ? "text/plain" : "text/html" } }));
    expect(await readSiteMenu("https://law.example/")).toBeNull();
  });
});

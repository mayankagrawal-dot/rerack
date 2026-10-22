// Demo data for a FICTIONAL chain. It is generated the same way every time (a fixed seed), and it is
// turned into ordinary CSV text, so the demo goes through exactly the same checks as a real upload.
export const DEMO_BUSINESS = "Northstar Apparel";

export type DemoFile = { name: string; store: string; text: string };

const STORES = [
  { store: "Indiranagar", file: "indiranagar.csv" },
  { store: "Koramangala", file: "koramangala.csv" },
  { store: "Whitefield", file: "whitefield.csv" },
  { store: "Jayanagar", file: "jayanagar.csv" },
  { store: "HSR Layout", file: "hsr-layout.csv" },
];

type Product = { item: string; colours: string[]; sizes: string[]; sizeFactor: number[] };

const PRODUCTS: Product[] = [
  { item: "Kurta", colours: ["Navy", "Maroon", "Mustard", "Teal"], sizes: ["S", "M", "L", "XL"], sizeFactor: [0.7, 1.2, 1.0, 0.6] },
  { item: "Shirt", colours: ["White", "Sky Blue", "Olive"], sizes: ["S", "M", "L", "XL"], sizeFactor: [0.7, 1.2, 1.0, 0.6] },
  { item: "Jeans", colours: ["Indigo", "Black", "Grey"], sizes: ["30", "32", "34", "36"], sizeFactor: [0.6, 1.2, 1.1, 0.6] },
  { item: "Trousers", colours: ["Khaki", "Charcoal"], sizes: ["30", "32", "34", "36"], sizeFactor: [0.6, 1.2, 1.1, 0.6] },
  { item: "Dress", colours: ["Floral Pink", "Black", "Emerald"], sizes: ["S", "M", "L"], sizeFactor: [0.9, 1.2, 0.9] },
  { item: "Sneakers", colours: ["White", "Black"], sizes: ["UK 7", "UK 8", "UK 9", "UK 10"], sizeFactor: [0.6, 1.0, 1.2, 0.7] },
  { item: "Casual Shoes", colours: ["Tan", "Brown"], sizes: ["UK 7", "UK 8", "UK 9", "UK 10"], sizeFactor: [0.6, 1.0, 1.2, 0.7] },
];

// How strongly each store sells each product (the stores differ on purpose).
const AFFINITY: Record<string, Record<string, number>> = {
  Indiranagar: { Shirt: 1.3, Jeans: 1.2, Sneakers: 1.2, Kurta: 0.8, Dress: 1.1, Trousers: 1.0, "Casual Shoes": 0.9 },
  Koramangala: { Sneakers: 1.5, Jeans: 1.4, Shirt: 1.0, Kurta: 0.6, Dress: 1.0, Trousers: 0.8, "Casual Shoes": 1.1 },
  Whitefield: { Kurta: 1.4, Dress: 1.3, Trousers: 1.1, Shirt: 0.9, Jeans: 0.8, Sneakers: 0.8, "Casual Shoes": 1.0 },
  Jayanagar: { Kurta: 1.2, Trousers: 1.3, "Casual Shoes": 1.3, Shirt: 1.0, Jeans: 0.7, Dress: 0.7, Sneakers: 0.6 },
  "HSR Layout": { Jeans: 1.1, Sneakers: 1.2, Dress: 1.2, Shirt: 1.1, Kurta: 0.9, Trousers: 0.9, "Casual Shoes": 0.8 },
};

type Row = { store: string; item: string; size: string; colour: string; age: number; onHand: number; sold: number };

// A small, fixed-seed random number generator, so the demo is identical on every load.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRows(): Row[] {
  const rnd = mulberry32(27);
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const rows: Row[] = [];

  for (const p of PRODUCTS) {
    p.sizes.forEach((size, si) => {
      p.colours.forEach((colour, ci) => {
        const styleRoll = rnd();
        const kind = styleRoll < 0.09 ? "aged" : styleRoll < 0.31 ? "uneven" : styleRoll < 0.41 ? "new" : "healthy";
        const baseAge = between(12, 48);
        const carried = STORES.filter(() => rnd() < 0.82);
        if (carried.length < 3) carried.push(...STORES.filter((s) => !carried.includes(s)).slice(0, 3 - carried.length));
        const strongStore = carried[between(0, carried.length - 1)].store;
        const stuckStore = carried.filter((s) => s.store !== strongStore)[between(0, carried.length - 2)].store;

        for (const { store } of carried) {
          const rate = 1.1 * AFFINITY[store][p.item] * p.sizeFactor[si] * (1.2 - ci * 0.15);
          let age = baseAge + between(0, 9);
          let sold = Math.max(0, Math.round(rate * 4 * (0.7 + rnd() * 0.6)));
          let onHand = Math.max(0, Math.round((rate * (2 + rnd() * 4)) + (rnd() < 0.2 ? 2 : 0)));

          if (kind === "aged") {
            age = between(62, 98);
            sold = between(0, 2);
            onHand = between(3, 9);
          } else if (kind === "uneven" && store === strongStore) {
            sold = between(10, 16);
            onHand = between(1, 4);
            age = between(20, 45);
          } else if (kind === "uneven" && store === stuckStore) {
            sold = between(0, 1);
            onHand = between(6, 12);
            age = between(50, 78);
          } else if (kind === "new") {
            age = between(3, 18);
          }
          rows.push({ store, item: p.item, size, colour, age, onHand, sold });
        }
      });
    });
  }

  // Hand-set cases, so the demo always shows the situations a retailer cares about.
  const set = (store: string, item: string, size: string, colour: string, age: number, onHand: number, sold: number) => {
    const row = rows.find((r) => r.store === store && r.item === item && r.size === size && r.colour === colour);
    if (row) Object.assign(row, { age, onHand, sold });
    else rows.push({ store, item, size, colour, age, onHand, sold });
  };
  // 1. Stuck in one store, selling quickly in another (the scope document's example).
  set("Jayanagar", "Kurta", "M", "Navy", 84, 12, 0);
  set("Whitefield", "Kurta", "M", "Navy", 40, 3, 14);
  for (const store of ["Indiranagar", "Koramangala", "HSR Layout"]) set(store, "Kurta", "M", "Navy", 28, 9, 5);
  // 2. Old, but selling well: should NOT be discounted.
  set("Koramangala", "Jeans", "32", "Indigo", 70, 10, 16);
  // 3. Too little data to act safely: new stock, and a style that only one store carries.
  set("Whitefield", "Dress", "S", "Floral Pink", 9, 6, 0);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.item === "Sneakers" && r.size === "UK 10" && r.colour === "White" && r.store !== "HSR Layout") rows.splice(i, 1);
  }
  set("HSR Layout", "Sneakers", "UK 10", "White", 55, 6, 0);

  return rows;
}

export function demoFiles(today = new Date()): DemoFile[] {
  const rows = buildRows();
  const iso = (days: number) => new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return STORES.map(({ store, file }) => {
    const lines = rows
      .filter((r) => r.store === store)
      .map((r) => [r.item, r.size, r.colour, iso(r.age), r.onHand, r.sold].join(","));
    return {
      name: file,
      store,
      text: ["item,size,colour,date_received,units_on_hand,units_sold", ...lines].join("\n") + "\n",
    };
  });
}

// A blank template the owner can download and fill in.
export function templateCsv(today = new Date()): string {
  const iso = (days: number) => new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return [
    "item,size,colour,date_received,units_on_hand,units_sold",
    `Kurta,M,Navy,${iso(45)},8,2`,
    `Shirt,L,White,${iso(20)},12,9`,
    `Jeans,32,Indigo,${iso(70)},15,1`,
  ].join("\n") + "\n";
}

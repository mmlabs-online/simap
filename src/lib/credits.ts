export type CreditEntry = {
  pack: string;
  author: string;
  url: string;
  licence: string;
  attribution: string;
};

/** Third-party art packs in use. Kept equal to the table in `assets/art/CREDITS.md` (checked by credits.test.ts). */
export const CREDITS: readonly CreditEntry[] = [
  {
    pack: "Office Pixel Art (Free v1.0)",
    author: "Imersa Studios",
    url: "https://imersastudios.itch.io/office-pixel-art",
    licence:
      "Custom itch.io licence (free tier): personal and commercial use, edit and recolour allowed, credit required.",
    attribution:
      "Office Pixel Art by Imersa Studios (https://imersastudios.itch.io/office-pixel-art)",
  },
];

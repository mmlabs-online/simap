import { CREDITS, type CreditEntry } from "@/lib/credits";
import { Card } from "../Card";
import { creditsCopy } from "../copy/credits";

/** Third-party art packs with author, source, licence and the attribution text the licence asks for (D45). */
export function CreditsPage({ credits = CREDITS }: { credits?: readonly CreditEntry[] }) {
  return (
    <div className="page-content flex flex-col gap-4">
      <h1 className="text-display text-text-primary">{creditsCopy.title}</h1>
      <p className="text-label font-normal text-text-secondary">{creditsCopy.intro}</p>
      {credits.length === 0 ? (
        <p className="text-label font-normal text-text-secondary">{creditsCopy.empty}</p>
      ) : (
        credits.map((c) => (
          <Card key={c.pack} as="section" className="flex flex-col gap-2 p-4">
            <h2 className="text-subtitle text-text-primary">{c.pack}</h2>
            <p className="text-label font-normal text-text-primary">
              <span className="font-semibold">{creditsCopy.author}: </span>
              {c.author}
            </p>
            <p className="text-label font-normal text-text-primary">
              <span className="font-semibold">{creditsCopy.source}: </span>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline"
              >
                {c.url}
              </a>
            </p>
            <p className="text-label font-normal text-text-primary">
              <span className="font-semibold">{creditsCopy.licence}: </span>
              {c.licence}
            </p>
            <p className="text-label font-normal text-text-primary">
              <span className="font-semibold">{creditsCopy.attribution}: </span>
              {c.attribution}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}

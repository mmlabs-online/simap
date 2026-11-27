import { EXPORT_KINDS, type ExportKind } from "@/lib/export/csv";
import { Button } from "../Button";
import { Card } from "../Card";
import { dashboardCopy } from "../copy/dashboard";

const copy = dashboardCopy.export;

/** CSV export entry (Manager+). Pure: the busy kind, messages and handler come from props. */
export function ExportCard({
  exporting,
  error,
  notice,
  onExport,
}: {
  exporting: ExportKind | null;
  error: string | null;
  notice: string | null;
  onExport: (kind: ExportKind) => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-subtitle text-text-primary">{copy.heading}</h2>
      <p className="text-label text-text-secondary">{copy.hint}</p>
      <div className="flex flex-wrap gap-2">
        {EXPORT_KINDS.map((kind) => (
          <Button
            key={kind}
            variant="tonal"
            size="sm"
            disabled={exporting !== null}
            aria-busy={exporting === kind}
            onClick={() => onExport(kind)}
          >
            {exporting === kind ? copy.busy : copy[kind]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-label font-semibold text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-label text-text-secondary">
          {notice}
        </p>
      )}
    </Card>
  );
}

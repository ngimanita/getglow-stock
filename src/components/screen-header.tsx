import { formatThaiDate } from '@/lib/format';

export function ScreenHeader({
  kicker,
  title,
  sub,
  today,
}: {
  kicker: string;
  title: string;
  sub: string;
  today: Date;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <p className="gg-kicker mb-1">{kicker}</p>
        <h1 className="gg-title mb-1.5">{title}</h1>
        <p className="text-[var(--text-muted)] text-[14px] sm:text-[15px]" style={{ maxWidth: 'var(--measure)' }}>
          {sub}
        </p>
      </div>
      <p className="text-[13px] text-[var(--text-muted)] shrink-0">ข้อมูล ณ {formatThaiDate(today)}</p>
    </div>
  );
}

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  back: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6L6 18',
  import: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  wand: 'M4 20L15 9M17 3v3M20 7h-3M19.5 4.5l-2 2M13 5h2M18 11v2',
  check: 'M5 12l5 5L20 7',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

import { tablerIconUrl, type LinkIcon } from '@/lib/tabler-icons';

// SVG files are served locally. Only icons actually displayed are downloaded.
export function HubIcon({ name, size = 23 }: { name: LinkIcon; size?: number }) {
  const mask = `url("${tablerIconUrl(name)}") center / contain no-repeat`;
  return <span aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0, width: size, height: size, backgroundColor: 'currentColor', mask, WebkitMask: mask }} />;
}

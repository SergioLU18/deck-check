import { useState } from 'react';

/** A card's art, or a plain card-shaped placeholder while it loads or if it can't. */
export function CardImage({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`card-image ${className}`}>
      {src && !failed && <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />}
    </span>
  );
}

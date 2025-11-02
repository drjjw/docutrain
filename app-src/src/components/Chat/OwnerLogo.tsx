/**
 * OwnerLogo - Displays owner logo from API
 * Ported from vanilla JS ui-document.js
 */

import { useOwnerLogo } from '@/hooks/useOwnerLogo';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface OwnerLogoProps {
  ownerSlug: string | null;
}

export function OwnerLogo({ ownerSlug }: OwnerLogoProps) {
  const { config, loading } = useOwnerLogo(ownerSlug);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check if owner_link is disabled
  const ownerLinkDisabled = searchParams.get('owner_link') === 'false';

  if (loading || !config || !ownerSlug) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    if (ownerLinkDisabled) {
      e.preventDefault();
      return;
    }
    // Navigate to owner page
    navigate(`/app/chat?owner=${encodeURIComponent(ownerSlug)}`);
  };

  return (
    <div className="flex items-center justify-start flex-shrink-0 w-full h-full">
      <a
        href={ownerLinkDisabled ? '#' : `/app/chat?owner=${encodeURIComponent(ownerSlug)}`}
        onClick={handleClick}
        className={`flex items-center transition-opacity hover:opacity-80 w-full ${
          ownerLinkDisabled ? 'cursor-default' : ''
        }`}
        title={ownerLinkDisabled ? `${config.alt} logo` : `View all documents for ${config.alt}`}
      >
        <img
          src={config.logo}
          alt={config.alt}
          className="h-7 md:h-[52px] w-auto max-w-[80px] md:max-w-[200px] object-contain transition-all drop-shadow-sm"
        />
      </a>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { trackViewContent } from '@/lib/meta-pixel';

export default function ViewTracker({ eventName, eventParams, contentName, contentCategory }) {
  useEffect(() => {
    trackEvent(eventName, eventParams);
    trackViewContent(contentName, contentCategory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

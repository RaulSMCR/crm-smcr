'use client';

// Widget reutilizable de Cloudflare Turnstile para los formularios públicos de
// autenticación (login, registros, recuperación). Reutiliza el mismo patrón que
// FaqContactSection: si NEXT_PUBLIC_TURNSTILE_SITE_KEY no está configurada, el
// widget no se monta y el envío no requiere token (desarrollo local).

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
export const CAPTCHA_ENABLED = SITE_KEY.length > 0;

/**
 * @param {{ onToken: (token: string) => void, theme?: 'light' | 'dark' | 'auto', className?: string }} props
 * ref expone reset() para reiniciar el widget tras un envío fallido.
 */
const AuthTurnstile = forwardRef(function AuthTurnstile({ onToken, theme = 'light', className = '' }, ref) {
  const innerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset: () => innerRef.current?.reset(),
  }));

  if (!CAPTCHA_ENABLED) return null;

  return (
    <div className={className}>
      <Turnstile
        ref={innerRef}
        siteKey={SITE_KEY}
        onSuccess={(token) => onToken(token)}
        onExpire={() => onToken('')}
        onError={() => onToken('')}
        options={{ theme, language: 'es' }}
      />
    </div>
  );
});

export default AuthTurnstile;

// src/components/brand/LogoTile.js
//
// Lockup de marca — dirección "Nouveau sutil".
//
// Lo que queda CONGELADO del logo original: la hoja de monstera (vector
// importado sin redibujar), el punto coral #FB7A62, y el tile crema #F6EFDF.
// El tile es crema SIEMPRE, también sobre fondo oscuro: así la hoja multitono
// nunca necesita recolorearse y el punto coral siempre contrasta.
//
// Lo que se REHIZO: la tipografía del wordmark (antes una sans condensada
// Déco, ahora Cormorant Garamond en versales reales) y la geometría del marco
// (esquina viva inferior izquierda + filete interior de Secesión).
//
// Tres cortes ópticos, no un archivo reescalado. Cormorant es una serif de
// contraste alto: sus trazos finos desaparecen en tamaños chicos, y "Costa
// Rica" es lo primero que se cae.
//
//   completo  >= 96px   tres líneas, con filete interior
//   compacto  44–95px   sin "Costa Rica", peso 700, tracking cerrado
//   simbolo   < 44px    solo la hoja
//
// Los tamaños van en `em` sobre un `font-size` igual al lado del tile, de modo
// que todo escala proporcionalmente con `size`.

const SERIF = 'var(--font-display)';

function cutFor(size, explicit) {
  if (explicit) return explicit;
  if (size < 44) return 'simbolo';
  if (size < 96) return 'compacto';
  return 'completo';
}

export default function LogoTile({
  size = 120,
  cut: cutProp,
  hair: hairProp,
  className = '',
  title = 'Salud Mental Costa Rica',
}) {
  const cut = cutFor(size, cutProp);
  const showText = cut !== 'simbolo';
  const showCostaRica = cut === 'completo';
  // El filete solo en los cortes grandes: por debajo se empasta con el borde.
  const hair = hairProp ?? cut === 'completo';

  const lineA =
    cut === 'compacto'
      ? { fontWeight: 700, fontSize: '.163em', letterSpacing: '.09em', textIndent: '.09em' }
      : { fontWeight: 600, fontSize: '.152em', letterSpacing: '.14em', textIndent: '.14em' };

  return (
    <span
      className={className}
      role="img"
      aria-label={title}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flex: 'none',
        background: '#F6EFDF',
        // Padding asimétrico: compensa el peso visual de la hoja.
        padding: '.11em .07em .10em',
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${size}px`,
        // La esquina viva, misma firma que los botones del sistema.
        borderRadius: '.18em .18em .18em .025em',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/leaf-coral.svg"
        alt=""
        aria-hidden="true"
        style={{ width: '.40em', height: '.40em', display: 'block', marginBottom: '.035em' }}
      />

      {showText ? (
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            color: '#1E4F52',
            fontFamily: SERIF,
            textTransform: 'uppercase',
            lineHeight: 0.98,
          }}
        >
          {/* text-indent compensa el tracking del último carácter; sin él el
              bloque se descentra hacia la izquierda. */}
          <span style={lineA}>Salud</span>
          <span style={lineA}>Mental</span>
          {showCostaRica ? (
            <span
              style={{
                fontWeight: 400,
                fontSize: '.082em',
                lineHeight: 1.5,
                letterSpacing: '.30em',
                textIndent: '.30em',
              }}
            >
              Costa Rica
            </span>
          ) : null}
        </span>
      ) : null}

      {hair ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '.055em',
            pointerEvents: 'none',
            border: '.008em solid rgba(30,79,82,.24)',
            borderRadius: '.13em .13em .13em .018em',
          }}
        />
      ) : null}
    </span>
  );
}

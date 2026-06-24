'use client';

import { useState, useEffect } from 'react';

// ── QUIE® Official Palette
const C = {
  carbon:   '#1A1A1A',
  terracota:'#C4622D',
  arcilla:  '#D4956A',
  verde:    '#3D5A3E',
  dorado:   '#E8C87A',
} as const;

// ── Text corpus
const BODY_TEXT = `There was a time when the earth spoke
through human hands.

There were no factories.
There was no rush.
Only clay, leather, needle and thread
and the silent knowledge
that passes from parent to child
without the need for words.

Somewhere in Colombia —
where the river descends from the mountain
and the mist still embraces the hills
before the sun arrives —
an artisan spread a piece of leather
across his workbench.

He looked at it for a long time.

Not because he didn't know what to do.
But because he knew
that what he was about to create
would outlast him.

That changes the way you work.
That changes everything.

—

QUIE means earth.
Not the earth you walk on —
the earth that holds you up.
The one that keeps seeds
and gives back life.
The one that remembers
when everything else forgets.

Every piece that leaves our workshops
carries that memory.

The leather we use
was skin that protected another living being.
The hands that cut it
learned from hands that are no longer here.
The thread that binds it
is the same gesture
that wove the first communities
of this land.

We do not make accessories.

We keep time.
We transfer history.
We create objects that age well
because they were made with honesty.

—

Today you carry with you
a fragment of all that.

You scanned the tag
and found this message
because we believe
you deserve to know
where what you touch comes from.

You deserve to know
that real hands were behind it.
A real story.
A real land.

Not an algorithm.
Not an assembly line.
Not an empty logo.

Just us.
Just you.
And this object between us both
that will outlast this conversation.

—

Welcome to QUIE®.

`;

const FINAL_TEXT = 'From the earth.\nForever.';

const LS_KEY      = 'quie_origin_seen';
const CHAR_DELAY  = 40; // ms per character
const MIDPOINT    = Math.floor(BODY_TEXT.length / 2);

// ── Inline text renderer — splits by paragraph and decorates "—" dividers
function BodyRenderer({
  text,
  showCursor,
}: {
  text: string;
  showCursor: boolean;
}) {
  const paragraphs = text.split('\n\n');

  return (
    <>
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (trimmed === '—') {
          return (
            <div
              key={pi}
              className="text-center my-8 select-none"
              style={{ color: C.arcilla, fontSize: '22px' }}
            >
              —
            </div>
          );
        }

        const lines = para.split('\n');
        const isLastParagraph = pi === paragraphs.length - 1;

        return (
          <p
            key={pi}
            className="mb-6"
            style={{
              color: 'rgba(255,255,255,0.88)',
              fontSize: 'clamp(17px, 4vw, 20px)',
              lineHeight: '2',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {lines.map((line, li) => {
              const isLastLine = isLastParagraph && li === lines.length - 1;
              return (
                <span key={li}>
                  {line}
                  {isLastLine && showCursor && (
                    <span className="quie-cursor">|</span>
                  )}
                  {li < lines.length - 1 && <br />}
                </span>
              );
            })}
          </p>
        );
      })}
    </>
  );
}

// ────────────────────────────────────────────────
// BrandOrigin — main component
// ────────────────────────────────────────────────
export interface BrandOriginProps {
  /** Artisan background image path. Replace with your own asset. */
  backgroundImage?: string;
  /** Called once the full experience has completed and localStorage is marked. */
  onComplete?: () => void;
  /** Called when the user clicks "Conoce tu pieza →". */
  onCtaClick?: () => void;
}

export default function BrandOrigin({
  backgroundImage = '/images/quie-artesano.jpg',
  onComplete,
  onCtaClick,
}: BrandOriginProps) {
  const [mounted,       setMounted]       = useState(false);
  const [alreadySeen,   setAlreadySeen]   = useState(false);
  const [bodyTyped,     setBodyTyped]     = useState(0);
  const [finalTyped,    setFinalTyped]    = useState(0);
  const [showImage,     setShowImage]     = useState(false);
  const [bgTransitioned,setBgTransitioned]= useState(false);
  const [showLogo,      setShowLogo]      = useState(false);
  const [showCTA,       setShowCTA]       = useState(false);

  // Mount + localStorage check (runs only on client)
  useEffect(() => {
    setMounted(true);
    const seen = localStorage.getItem(LS_KEY) === 'true';
    setAlreadySeen(seen);
    if (seen) {
      setBodyTyped(BODY_TEXT.length);
      setFinalTyped(FINAL_TEXT.length);
      setShowImage(true);
      setBgTransitioned(true);
      setShowLogo(true);
      setShowCTA(true);
    }
  }, []);

  // Body typewriter
  useEffect(() => {
    if (!mounted || alreadySeen) return;
    if (bodyTyped >= BODY_TEXT.length) return;

    const t = setTimeout(() => {
      const next = bodyTyped + 1;
      setBodyTyped(next);
      if (next >= MIDPOINT) {
        setShowImage(true);
        setBgTransitioned(true);
      }
    }, CHAR_DELAY);

    return () => clearTimeout(t);
  }, [mounted, alreadySeen, bodyTyped]);

  // Final phrase typewriter (starts 500 ms after body finishes)
  useEffect(() => {
    if (!mounted || alreadySeen) return;
    if (bodyTyped < BODY_TEXT.length) return;
    if (finalTyped >= FINAL_TEXT.length) return;

    const delay = finalTyped === 0 ? 500 : CHAR_DELAY;
    const t = setTimeout(() => setFinalTyped((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [mounted, alreadySeen, bodyTyped, finalTyped]);

  // Logo appears 800 ms after final phrase completes
  useEffect(() => {
    if (finalTyped < FINAL_TEXT.length || showLogo) return;
    const t = setTimeout(() => setShowLogo(true), 800);
    return () => clearTimeout(t);
  }, [finalTyped, showLogo]);

  // CTA appears 600 ms after logo; mark experience as seen
  useEffect(() => {
    if (!showLogo || showCTA) return;
    const t = setTimeout(() => {
      setShowCTA(true);
      localStorage.setItem(LS_KEY, 'true');
      onComplete?.();
    }, 600);
    return () => clearTimeout(t);
  }, [showLogo, showCTA, onComplete]);

  // Blank carbon screen during SSR / hydration
  if (!mounted) {
    return <div style={{ backgroundColor: C.carbon, minHeight: '100vh' }} />;
  }

  const isTypingBody  = bodyTyped < BODY_TEXT.length;
  const isTypingFinal = !isTypingBody && finalTyped < FINAL_TEXT.length;

  return (
    <>
      {/* Keyframe for cursor blink — scoped to this component */}
      <style>{`
        @keyframes quie-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .quie-cursor {
          display: inline-block;
          margin-left: 2px;
          color: ${C.arcilla};
          animation: quie-blink 0.8s step-end infinite;
        }
      `}</style>

      <div
        className="min-h-screen w-full relative overflow-x-hidden"
        style={{
          backgroundColor: bgTransitioned ? C.terracota : C.carbon,
          transition: 'background-color 3s ease',
        }}
      >
        {/* Artisan background image — fade in at midpoint */}
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            opacity: showImage ? 0.13 : 0,
            transition: 'opacity 2.5s ease',
          }}
        />

        {/* Persistent dark overlay for text legibility */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)',
          }}
        />

        {/* Scrollable text column */}
        <div className="relative z-10 max-w-lg mx-auto px-6 pt-16 pb-28">

          {/* — Body — */}
          <BodyRenderer
            text={BODY_TEXT.slice(0, bodyTyped)}
            showCursor={isTypingBody}
          />

          {/* — Final phrase in dorado arena — */}
          {finalTyped > 0 && (
            <p
              className="mt-4 mb-16"
              style={{
                color: C.dorado,
                fontSize: 'clamp(22px, 6vw, 28px)',
                lineHeight: '1.9',
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontStyle: 'italic',
                whiteSpace: 'pre-line',
              }}
            >
              {FINAL_TEXT.slice(0, finalTyped)}
              {isTypingFinal && <span className="quie-cursor">|</span>}
            </p>
          )}

          {/* — QUIE® Logo fade in — */}
          <div
            className="text-center mt-8 mb-10"
            style={{
              opacity: showLogo ? 1 : 0,
              transition: 'opacity 1.5s ease',
            }}
          >
            <div
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 'clamp(28px, 8vw, 38px)',
                fontWeight: 900,
                letterSpacing: '0.35em',
                color: C.dorado,
                textShadow: `0 0 48px ${C.dorado}44`,
              }}
            >
              QUIE®
            </div>
            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: C.arcilla,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Colombian craftsmanship
            </div>
          </div>

          {/* — CTA button — */}
          <div
            className="text-center"
            style={{
              opacity: showCTA ? 1 : 0,
              transition: 'opacity 1s ease',
            }}
          >
            <button
              onClick={onCtaClick}
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '13px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: C.carbon,
                backgroundColor: C.dorado,
                border: 'none',
                padding: '16px 38px',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 10px 28px ${C.dorado}55`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Discover your piece →
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────
// BrandOriginTrigger — reusable "Nuestra historia" button
// ────────────────────────────────────────────────
export function BrandOriginTrigger({
  label     = 'Our story',
  className = '',
  onClick,
}: {
  label?:     string;
  className?: string;
  onClick?:   () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        fontFamily:      'system-ui, sans-serif',
        fontSize:        '12px',
        letterSpacing:   '0.18em',
        textTransform:   'uppercase',
        color:           C.arcilla,
        backgroundColor: 'transparent',
        border:          `1px solid ${C.arcilla}`,
        padding:         '10px 24px',
        cursor:          'pointer',
        transition:      'background-color 0.25s ease, color 0.25s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = `${C.arcilla}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {label}
    </button>
  );
}

// src/components/ornaments/WhiplashCorner.js
// Ornamento de línea "latigazo" (Secesión vienesa / Escuela de Glasgow).
// Decorativo: aria-hidden y sin foco. El trazo usa currentColor.
export default function WhiplashCorner({ className }) {
  return (
    <svg viewBox="0 0 300 300" fill="none" aria-hidden="true" focusable="false" className={className}>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M8 292 C 78 268 112 214 104 154 C 98 108 130 74 176 78 C 214 81 236 112 226 142 C 217 168 184 174 172 154 C 163 139 176 122 190 128" />
        <path d="M32 292 C 96 262 124 210 116 156 C 110 114 138 86 178 90" />
        <path d="M104 154 C 60 138 34 100 44 62 C 50 38 78 28 96 42 C 110 53 108 76 92 80" />
        <path d="M226 142 C 258 152 276 184 264 212" />
      </g>
      <circle cx="190" cy="128" r="5" fill="currentColor" />
      <circle cx="92" cy="80" r="4" fill="currentColor" />
      <circle cx="264" cy="212" r="4.5" fill="currentColor" />
    </svg>
  );
}

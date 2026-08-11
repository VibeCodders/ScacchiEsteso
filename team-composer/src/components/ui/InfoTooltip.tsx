/**
 * Small CSS-only tooltip (native `title` would work too, but this stays visible on keyboard focus
 * and is more legible). Extracted from the estimator screen — used anywhere a short explanation
 * needs a hover/focus affordance.
 */
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex outline-none" tabIndex={0}>
      <span className="cursor-help text-xs text-blue-400" aria-hidden="true">ⓘ</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 w-56 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-normal leading-relaxed text-slate-300 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export default InfoTooltip;

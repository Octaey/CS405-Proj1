const r5 = (p) => p.map((x) => Math.round(x * 1e5) / 1e5);

export function curveToJSON(curve) {
  const out = { painting: curve.painting, kind: curve.kind };
  if (curve.kind === 'bezier-c1') out.segments = curve.segments.map((s) => s.map(r5));
  else out.points = curve.points.map(r5);
  return out;
}

/** Provided: save any object as a .json download in the browser. */
export function downloadJSON(obj, filename = 'curve.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

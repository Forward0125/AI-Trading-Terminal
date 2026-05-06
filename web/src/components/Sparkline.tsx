"use client";

/**
 * Tiny inline-SVG sparkline. Lighter than spinning up a full
 * lightweight-charts instance per watchlist row.
 */

interface Props {
  values:  number[];
  width?:  number;
  height?: number;
  color?:  string;
}

export function Sparkline({
  values,
  width  = 120,
  height = 32,
  color  = "#06b6d4",
}: Props) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="opacity-50" />;
  }

  const min   = Math.min(...values);
  const max   = Math.max(...values);
  const range = max - min || 1;

  const step = width / (values.length - 1);
  let path = `M 0 ${height - ((values[0] - min) / range) * height}`;
  for (let i = 1; i < values.length; i++) {
    const x = i * step;
    const y = height - ((values[i] - min) / range) * height;
    path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }

  // Fill area under the line for a soft glow.
  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <path d={fillPath} fill={color} fillOpacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

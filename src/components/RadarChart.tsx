/**
 * 轻量 SVG 雷达图 - 展示薄弱标签权重分布
 */
interface RadarData {
  name: string;
  value: number; // 0-100
}

export default function RadarChart({ data, size = 260 }: { data: RadarData[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const levels = 4;
  const n = Math.max(data.length, 3);

  if (data.length === 0) return null;

  // 计算各点坐标
  const angleStep = (Math.PI * 2) / n;
  const points = data.map((d, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (d.value / 100) * radius;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      labelX: cx + Math.cos(angle) * (radius + 18),
      labelY: cy + Math.sin(angle) * (radius + 18),
      name: d.name,
      value: d.value,
    };
  });

  // 多边形路径
  const polygonPath = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* 网格圆 */}
      {Array.from({ length: levels }).map((_, i) => {
        const r = (radius * (i + 1)) / levels;
        const gridPoints = Array.from({ length: n }).map((_, j) => {
          const angle = -Math.PI / 2 + j * angleStep;
          return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
        }).join(" ");
        return (
          <polygon
            key={i}
            points={gridPoints}
            fill="none"
            stroke="#D6DCEF"
            strokeWidth="0.8"
            opacity={0.5}
          />
        );
      })}

      {/* 轴线 */}
      {points.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.labelX - (p.labelX - cx) * 0.18}
          y2={p.labelY - (p.labelY - cy) * 0.18}
          stroke="#D6DCEF"
          strokeWidth="0.8"
          opacity={0.5}
        />
      ))}

      {/* 数据多边形 */}
      <polygon
        points={polygonPath}
        fill="rgba(30, 42, 94, 0.15)"
        stroke="#E63946"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#E63946" />
      ))}

      {/* 标签 */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.labelX}
          y={p.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[10px] fill-ink-500 font-medium"
          style={{ fontSize: "10px", fill: "#5569A8" }}
        >
          {p.name}
        </text>
      ))}
    </svg>
  );
}

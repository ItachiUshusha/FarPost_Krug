"use client";
import { useId } from "react";
import type { CircleMember } from "../../../shared/krug/types";
import { typeLabel } from "../../../shared/krug/reference";
export function CircleDiagram({ members, compact = false }: { members: CircleMember[]; compact?: boolean }) {
  const markerId = useId().replace(/:/g, "");
  const n = members.length, radius = n === 2 ? 92 : 116, center = 180;
  const points = members.map((_, i) => { const angle = -Math.PI / 2 + 2 * Math.PI * i / n; return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }; });
  return <div className={`circle-diagram ${compact ? "diagram-compact" : ""}`}>
    <svg viewBox="0 0 360 360" role="img" aria-label={`Круг из ${n} участников. Стрелки показывают, кому передать вещь.`}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m0 0 10 5-10 5Z" fill="currentColor" /></marker></defs>
      <circle cx="180" cy="180" r={radius} className="diagram-orbit" />
      <text x="180" y="175" textAnchor="middle" className="diagram-center">{n}</text><text x="180" y="195" textAnchor="middle" className="diagram-sub">участника</text>
      {points.map((p, i) => { const q = points[(i + 1) % n], dx = q.x - p.x, dy = q.y - p.y, distance = Math.hypot(dx, dy), sign = n === 2 ? 18 : 0;
        const sx = p.x + dx / distance * 35, sy = p.y + dy / distance * 35;
        const ex = q.x - dx / distance * 40, ey = q.y - dy / distance * 40;
        return <path key={`edge${i}`} d={`M${sx} ${sy} Q${(sx + ex) / 2 - dy / distance * (20 + sign)} ${(sy + ey) / 2 + dx / distance * (20 + sign)} ${ex} ${ey}`} className="diagram-edge" markerEnd={`url(#${markerId})`} />;
      })}
      {points.map((p, i) => <g key={members[i].userId}>
        <circle cx={p.x} cy={p.y} r="30" className={`diagram-person person-${i}`} />
        <text x={p.x} y={p.y + 6} textAnchor="middle" className="diagram-initial">{members[i].name.slice(0, 1)}</text>
        <text x={p.x} y={p.y + 47} textAnchor="middle" className="diagram-name">{members[i].name.split(" ")[0]}</text>
        <text x={p.x} y={p.y + 63} textAnchor="middle" className="diagram-item">{typeLabel(members[i].giveTypeId)}</text>
      </g>)}
    </svg>
    {!compact && <ol className="transfer-list">{members.map((m, i) => <li key={m.userId}><span className={`number person-${i}`}>{i + 1}</span><span><strong>{m.name}</strong> передаёт <strong>{m.giveTitle}</strong> участнику {members.find((person) => person.userId === m.giveToId)?.name}.</span></li>)}</ol>}
  </div>;
}

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import type { ProjectStage } from "@/lib/types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

const STAGE_COLORS: Record<ProjectStage, string> = {
  lead: "#38bdf8",
  proposal: "#fbbf24",
  active: "#34d399",
  completed: "#a1a1aa",
};

export interface ChartDatum {
  stage: ProjectStage;
  label: string;
  value: number;
  count: number;
}

export function PipelineValueChart({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="label"
          stroke="hsl(36 7% 58%)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(36 7% 58%)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "hsl(24 7% 18% / 0.5)" }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const d = payload[0].payload as ChartDatum;
            return (
              <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                <p className="font-medium">{d.label}</p>
                <p className="mt-0.5 text-gold">{formatCurrency(d.value)}</p>
                <p className="text-muted-foreground">
                  {d.count} project{d.count === 1 ? "" : "s"}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
          {data.map((d) => (
            <Cell key={d.stage} fill={STAGE_COLORS[d.stage]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

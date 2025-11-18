"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import { useI18nLocale, useI18nTranslations } from "@components/I18nProvider";

Chart.register(BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type AssignmentInsight = {
  memberId: string;
  memberName: string | null;
  username: string | null;
  totalAssignments: number;
  leaderAssignments: number;
};

type CelebrationInsight = {
  month: string;
  total: number;
};

type AdminStatsResponse = {
  totals: {
    volunteers: number;
    ministries: number;
    leaders: number;
    celebrationsUpcoming: number;
  };
  assignmentsByMember: AssignmentInsight[];
  celebrationsPerMonth: CelebrationInsight[];
};

export default function AdminInsightsDashboardCard() {
  const t = useI18nTranslations("admin.dashboard");
  const locale = useI18nLocale();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);

  const fetchStats = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/stats", { signal });
        const json = (await response.json()) as AdminStatsResponse & { error?: string };
        if (!response.ok) {
          throw new Error(json.error || t("error.title"));
        }
        setStats(json);
      } catch (err) {
        if (signal?.aborted) return;
        setStats(null);
        setError(err instanceof Error ? err.message : t("error.title"));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchStats]);

  const sortedAssignments = useMemo(() => {
    if (!stats) return [];
    return [...stats.assignmentsByMember].sort((a, b) => b.totalAssignments - a.totalAssignments);
  }, [stats]);

  const topAssignments = useMemo(() => sortedAssignments.slice(0, 5), [sortedAssignments]);

  const hasData =
    stats &&
    (sortedAssignments.length > 0 || stats.celebrationsPerMonth.some((point) => Number(point.total) > 0));

  const assignmentChartData = useMemo(
    () => ({
      labels: topAssignments.map((entry) => entry.memberName || entry.username || entry.memberId.slice(0, 8)),
      datasets: [
        {
          label: t("charts.assignmentsTitle"),
          data: topAssignments.map((entry) => entry.totalAssignments),
          backgroundColor: "rgba(14,165,233,0.8)",
          hoverBackgroundColor: "rgba(14,165,233,1)",
          borderRadius: 12
        }
      ]
    }),
    [topAssignments, t]
  );

  const celebrationChartData = useMemo(
    () => ({
      labels: (stats?.celebrationsPerMonth ?? []).map((point) => {
        const date = new Date(point.month);
        return monthFormatter.format(date);
      }),
      datasets: [
        {
          label: t("charts.celebrationsTitle"),
          data: (stats?.celebrationsPerMonth ?? []).map((point) => point.total),
          borderColor: "rgba(129,140,248,1)",
          backgroundColor: "rgba(129,140,248,0.2)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#818cf8"
        }
      ]
    }),
    [stats, monthFormatter, t]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#312e81",
          borderWidth: 1,
          callbacks: {
            label(context: any) {
              const value = context.parsed.y ?? context.parsed;
              return String(value);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#cbd5f5", maxRotation: 45, minRotation: 0 }
        },
        y: {
          grid: { color: "rgba(148,163,184,0.2)" },
          ticks: { color: "#cbd5f5", precision: 0, stepSize: 1, beginAtZero: true }
        }
      }
    }),
    []
  );

  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#312e81",
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(148,163,184,0.2)" },
          ticks: { color: "#cbd5f5" }
        },
        y: {
          grid: { color: "rgba(148,163,184,0.2)" },
          ticks: { color: "#cbd5f5", precision: 0, beginAtZero: true }
        }
      }
    }),
    []
  );

  const metricOrder: Array<keyof AdminStatsResponse["totals"]> = [
    "volunteers",
    "ministries",
    "leaders",
    "celebrationsUpcoming"
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.45em] text-indigo-200/80">{t("title")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{t("subtitle")}</h2>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100" role="alert">
          <p className="font-semibold">{t("error.title")}</p>
          <p className="mt-1 text-rose-100/80">{error}</p>
          <button
            type="button"
            onClick={() => fetchStats()}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200/40 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-100 transition hover:bg-rose-500/10 disabled:opacity-60"
            disabled={loading}
          >
            {t("error.retry")}
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricOrder.map((key) => (
          <article
            key={key}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center shadow-inner shadow-black/30"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200/70">{t(`metrics.${key}`)}</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {numberFormatter.format(stats?.totals[key] ?? 0)}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {hasData ? (
          <>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30">
              <p className="text-sm font-semibold text-white">{t("charts.assignmentsTitle")}</p>
              <p className="text-xs text-indigo-100/70">{t("charts.assignmentsDescription")}</p>
              <div className="mt-4 h-64">
                <Bar
                  data={assignmentChartData}
                  options={chartOptions}
                  aria-label={t("charts.assignmentsTitle")}
                  role="img"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30">
              <p className="text-sm font-semibold text-white">{t("charts.celebrationsTitle")}</p>
              <p className="text-xs text-indigo-100/70">{t("charts.celebrationsDescription")}</p>
              <div className="mt-4 h-64">
                <Line
                  data={celebrationChartData}
                  options={lineChartOptions}
                  aria-label={t("charts.celebrationsTitle")}
                  role="img"
                />
              </div>
            </article>
          </>
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-indigo-100/80">
            <p className="text-lg font-semibold text-white">{t("empty.title")}</p>
            <p className="mt-2 text-sm">{t("empty.description")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

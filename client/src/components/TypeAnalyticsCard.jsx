import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { PatternBadge, TYPE_CONFIG } from './PatternRenderers';
import { TrendingUp, AlertTriangle, CheckCircle2, Award } from 'lucide-react';

export function TypeAnalyticsCard({ typeResults = [] }) {
  // Only display question types that actually exist in this exam (total > 0)
  const activeTypes = (typeResults || []).filter((t) => (t.total || 0) > 0);
  if (!activeTypes.length) return null;

  // Identify strengths and improvement areas
  const sorted = [...activeTypes].sort((a, b) => b.accuracy - a.accuracy);
  const strongest = sorted.find((s) => s.accuracy >= 60 && s.attempted >= 1);
  const weakest = [...sorted].reverse().find((s) => s.accuracy < 60 && s.attempted >= 1);

  return (
    <div className="type-analytics-container panel">
      <div className="type-analytics-header">
        <div>
          <h3>Question-Pattern Breakdown</h3>
          <p>Accuracy and average solving speed across question categories.</p>
        </div>
        <div className="insights-pills">
          {strongest && (
            <div className="insight-pill strong">
              <Award size={14} />
              <span>
                Strongest: <b>{strongest.label}</b> ({strongest.accuracy.toFixed(0)}%)
              </span>
            </div>
          )}
          {weakest && (
            <div className="insight-pill weak">
              <AlertTriangle size={14} />
              <span>
                Needs Focus: <b>{weakest.label}</b> ({weakest.accuracy.toFixed(0)}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bar Chart for Type Accuracy */}
      <div className="type-chart-wrapper">
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={activeTypes} margin={{ top: 10, right: 10, left: -25, bottom: 25 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748b' }}
              interval={0}
              angle={-15}
              textAnchor="end"
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
            <Tooltip
              formatter={(val) => [`${Number(val).toFixed(1)}%`, 'Accuracy']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
            />
            <Bar dataKey="accuracy" radius={[5, 5, 0, 0]} maxBarSize={45}>
              {activeTypes.map((entry, index) => {
                const conf = TYPE_CONFIG[entry.type] || TYPE_CONFIG.general_mcq;
                return <Cell key={`cell-${index}`} fill={conf.color || '#6366f1'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Type Cards Grid */}
      <div className="type-breakdown-grid">
        {activeTypes.map((t) => {
          const conf = TYPE_CONFIG[t.type] || TYPE_CONFIG.general_mcq;
          const avgSec = Math.round(t.averageTime || 0);
          return (
            <div
              key={t.type}
              className="type-stat-card"
              style={{ borderLeftColor: conf.color }}
            >
              <div className="type-stat-top">
                <PatternBadge type={t.type} customLabel={t.label} size="small" />
                <span className="type-acc-value" style={{ color: t.accuracy >= 70 ? '#15804b' : t.accuracy >= 40 ? '#d97706' : '#b91c1c' }}>
                  {t.accuracy.toFixed(0)}% Acc
                </span>
              </div>
              <div className="type-stat-metrics">
                <div>
                  <span>Score</span>
                  <b>{t.correct} / {t.total}</b>
                </div>
                <div>
                  <span>Avg Time</span>
                  <b>{avgSec}s / q</b>
                </div>
                <div>
                  <span>Attempted</span>
                  <b>{t.attempted} / {t.total}</b>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

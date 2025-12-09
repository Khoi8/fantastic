import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { PlayerZScore } from '../../types/sleeper';

interface Props {
  playerA: PlayerZScore;
  height?: number;
}

const DISPLAY_CATEGORIES = ['pts', 'ast', 'stl', 'blk', 'reb', 'to'];

export const ZScoreRadar: React.FC<Props> = ({ playerA, height = 300 }) => {
  const data = DISPLAY_CATEGORIES.map((cat) => ({
    subject: cat.toUpperCase(),
    A: playerA.scores[cat] || 0,
    fullMark: 3,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div
          style={{
            background: 'white',
            padding: '5px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>{dataPoint.subject}</p>
          <p
            style={{
              margin: 0,
              color: Math.abs(dataPoint.A) < 1 ? '#666' : dataPoint.A > 0 ? 'green' : 'red',
            }}
          >
            {dataPoint.A > 0 ? '+' : ''}
            {dataPoint.A.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 10, fontWeight: 'bold' }} />
          <PolarRadiusAxis angle={90} domain={[-3, 3]} tickCount={5} tickFormatter={(val) => (val === 0 ? 'Avg' : '')} />
          <Radar name={playerA.name} dataKey="A" stroke="#8884d8" strokeWidth={2} fill="#8884d8" fillOpacity={0.5} />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

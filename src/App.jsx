import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import * as math from 'mathjs';

function App() {
  const [expr, setExpr] = useState('x^2 - 3*x + 2');
  const [error, setError] = useState('');

  const data = useMemo(() => {
    try {
      const compiled = math.compile(expr);
      const points = [];
      for (let x = -10; x <= 10; x += 0.25) {
        let y;
        try {
          y = compiled.evaluate({ x });
          if (typeof y !== 'number' || !isFinite(y) || Math.abs(y) > 1000) y = null;
        } catch {
          y = null;
        }
        points.push({ x: Math.round(x * 100) / 100, y });
      }
      setError('');
      return points;
    } catch (e) {
      setError('Invalid function. Try: x^2 - 3*x + 2');
      return [];
    }
  }, [expr]);

  return (
    <div style={{ minHeight: '100vh', background: '#0E1117', color: '#E8E6E1', padding: '32px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h1>AXIOM — Function Explorer</h1>

        <label style={{ display: 'block', marginBottom: 8 }}>f(x) =</label>
        <input
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          style={{ width: '100%', padding: 10, fontSize: 16, background: '#1A1E27', color: '#fff', border: '1px solid #333', borderRadius: 6, boxSizing: 'border-box' }}
        />

        {error && <p style={{ color: 'tomato' }}>{error}</p>}

        <div style={{ marginTop: 20, background: '#1A1E27', borderRadius: 8, padding: 10 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid stroke="#2C313D" strokeDasharray="3 3" />
              <XAxis dataKey="x" stroke="#888" />
              <YAxis stroke="#888" />
              <ReferenceLine x={0} stroke="#666" />
              <ReferenceLine y={0} stroke="#666" />
              <Tooltip />
              <Line type="monotone" dataKey="y" stroke="#7FB6A8" strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;
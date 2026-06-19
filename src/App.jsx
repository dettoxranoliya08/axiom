import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import * as math from 'mathjs';
import { analyzeFunction } from './lib/analyzer';
import ReactMarkdown from 'react-markdown';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function App() {
  const [expr, setExpr] = useState('x^2 - 3*x + 2');
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const taggedPoints = useMemo(() => {
    if (!expr || expr.trim() === '') return [];
    try {
      const compiled = math.compile(expr);
      const points = [];
      for (let x = -10; x <= 10; x += 0.1) {
        const cleanX = Math.round(x * 1000) / 1000;
        let y;
        try {
          y = compiled.evaluate({ x: cleanX });
          if (typeof y === 'object' && y !== null && 'im' in y) {
            points.push({ x: Math.round(x * 100) / 100, y: null, undefined: true });
          } else if (typeof y !== 'number' || isNaN(y) || !isFinite(y)) {
            points.push({ x: Math.round(x * 100) / 100, y: null, undefined: true });
          } else if (Math.abs(y) > 1000) {
            points.push({ x: Math.round(x * 100) / 100, y: null, clipped: true });
          } else {
            points.push({ x: Math.round(x * 100) / 100, y });
          }
        } catch {
          points.push({ x: Math.round(x * 100) / 100, y: null, undefined: true });
        }
      }
      setError('');
      return points;
    } catch (e) {
      setError('Invalid function. Try: x^2 - 3*x + 2');
      return [];
    }
  }, [expr]);

  const chartPoints = useMemo(() =>
    taggedPoints.map(p => ({ x: p.x, y: p.y })),
    [taggedPoints]
  );

  const insights = useMemo(() => analyzeFunction(taggedPoints), [taggedPoints]);

  const askWhy = async () => {
    setLoading(true);
    setExplanation('');
    try {
      const summary = {
        function: expr,
        symmetry: insights?.symmetry !== 'neither'
          ? `${insights?.symmetry} (${insights?.symmetryConfidence}% confidence)`
          : 'none',
        behavior: [
          ...(insights?.increasingRegions?.map(r => r.type) || []),
          ...(insights?.decreasingRegions?.map(r => r.type) || []),
          ...(insights?.constantRegions?.length ? ['Piecewise Constant'] : []),
        ].join(', ') || 'unknown',
        turningPoints: insights?.turningPoints?.length
          ? insights.turningPoints.map(p => `(${p[0]}, ${p[1]})`).join(', ')
          : 'none',
        continuity: insights?.continuity || 'continuous',
        asymptotes: insights?.asymptotes?.length ? `x = ${insights.asymptotes.join(', ')}` : 'none',
        hAsymptotes: insights?.horizontalAsymptotes?.length ? `y = ${insights.horizontalAsymptotes.join(', ')}` : 'none',
        jumpPoints: insights?.jumpDiscontinuities?.length ? `x = ${insights.jumpDiscontinuities.join(', ')}` : 'none',
        domain: insights?.domain || 'unknown',
        range: insights?.range ? `[${insights.range.min}, ${insights.range.max}] (visible range)` : 'unknown',
      };

      const prompt = `You are a mathematics teacher explaining to a Class 11 student.

Function: f(x) = ${summary.function}

Facts (already calculated):
- Symmetry: ${summary.symmetry}
- Behavior: ${summary.behavior}
- Turning Points: ${summary.turningPoints}
- Continuity Type: ${summary.continuity}
- Vertical Asymptotes: ${summary.asymptotes}
- Horizontal Asymptotes: ${summary.hAsymptotes}
- Jump Discontinuities: ${summary.jumpPoints}
- Domain: ${summary.domain}
- Range: ${summary.range}

YOUR TASK:
Do NOT repeat these facts.
Explain WHY each fact occurs using mathematical intuition.
Use Hinglish (Hindi + English mix).
Give concrete mathematical reasoning.
Use markdown formatting. 4-6 points.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Kuch error aaya, dobara try karo.';
      setExplanation(text);
    } catch (e) {
      setExplanation('Connection error. Dobara try karo.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0E1117', color: '#E8E6E1', padding: '32px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1>AXIOM — Function Explorer</h1>

        <label style={{ display: 'block', marginBottom: 8 }}>f(x) =</label>
        <input
          value={expr}
          onChange={(e) => { setExpr(e.target.value); setExplanation(''); }}
          style={{ width: '100%', padding: 10, fontSize: 16, background: '#1A1E27', color: '#fff', border: '1px solid #333', borderRadius: 6, boxSizing: 'border-box' }}
        />

        {error && <p style={{ color: 'tomato' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 400px', background: '#1A1E27', borderRadius: 8, padding: 10 }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartPoints}>
                <CartesianGrid stroke="#2C313D" strokeDasharray="3 3" />
                <XAxis dataKey="x" stroke="#888" ticks={[-10,-8,-6,-4,-2,0,2,4,6,8,10]} />
                <YAxis stroke="#888" />
                <ReferenceLine x={0} stroke="#666" />
                <ReferenceLine y={0} stroke="#666" />
                <Tooltip />
                <Line type="linear" dataKey="y" stroke="#7FB6A8" strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ flex: '1 1 250px', background: '#1A1E27', borderRadius: 8, padding: 16, fontSize: 14, lineHeight: 1.8 }}>
            <h3 style={{ marginTop: 0, color: '#7FB6A8' }}>Insights</h3>

            {insights && <>
              <div><strong>Domain:</strong> {insights.domain}</div>
              <div><strong>Visible Range:</strong> [{insights.range?.min}, {insights.range?.max}]</div>

              <div>
                <strong>Symmetry:</strong> {insights.symmetry}
                {insights.symmetryConfidence > 0 && (
                  <span style={{ color: '#9C9890' }}> ({insights.symmetryConfidence}% confidence)</span>
                )}
              </div>

              <div style={{ marginTop: 10 }}>
                <strong>Behavior:</strong>
                {insights.isConstant && <div style={{ color: '#9C9890' }}>Constant function</div>}
                {insights.increasingRegions?.map((r, i) => (
                  <div key={i} style={{ color: '#7FB6A8' }}>↑ {r.type}: ({r.range[0]}, {r.range[1]})</div>
                ))}
                {insights.decreasingRegions?.map((r, i) => (
                  <div key={i} style={{ color: '#E07A5F' }}>↓ {r.type}: ({r.range[0]}, {r.range[1]})</div>
                ))}
                {insights.constantRegions?.map((r, i) => (
                  <div key={i} style={{ color: '#9C9890' }}>→ Constant: ({r.range[0]}, {r.range[1]})</div>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                <strong>Turning points:</strong>
                {insights.turningPoints?.length
                  ? insights.turningPoints.map((p, i) => <div key={i}>({p[0]}, {p[1]})</div>)
                  : ' none'}
              </div>

              {(insights.continuity !== 'continuous' || insights.horizontalAsymptotes?.length > 0) && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ color: '#E0A458' }}>Asymptotes & Continuity:</strong>

                  {insights.continuity === 'vertical-asymptote' && (
                    <div style={{ color: '#E0A458', fontSize: 12, marginTop: 4 }}>
                      ⚡ Vertical Asymptote at x = {insights.asymptotes?.join(', ')}
                    </div>
                  )}
                  {insights.continuity === 'jump-discontinuity' && (
                    <div style={{ color: '#E0A458', fontSize: 12, marginTop: 4 }}>
                      ↕ Jump Discontinuity at x = {insights.jumpDiscontinuities?.join(', ')}
                    </div>
                  )}
                  {insights.continuity === 'removable-discontinuity' && (
                    <div style={{ color: '#E0A458', fontSize: 12, marginTop: 4 }}>
                      ○ Removable Discontinuity at x = {insights.removableDiscontinuities?.join(', ')}
                    </div>
                  )}
                  {insights.continuity === 'partially-undefined' && (
                    <div style={{ color: '#E0A458', fontSize: 12, marginTop: 4 }}>
                      ⚠️ Defined on restricted domain
                    </div>
                  )}
                  {insights.horizontalAsymptotes?.length > 0 && (
                    <div style={{ color: '#9C9890', fontSize: 12, marginTop: 4 }}>
                      → Horizontal Asymptote: y = {insights.horizontalAsymptotes.join(', ')}
                    </div>
                  )}
                  {insights.overflowRegions?.length > 0 && (
                    <div style={{ color: '#9C9890', fontSize: 11, marginTop: 4 }}>
                      📈 Overflow (too large to display): {insights.overflowRegions.map(r => `(${r[0]}, ${r[1]})`).join(', ')}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={askWhy}
                disabled={loading}
                style={{
                  marginTop: 16,
                  width: '100%',
                  padding: '10px',
                  background: loading ? '#2C313D' : '#7FB6A8',
                  color: loading ? '#9C9890' : '#0E1117',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 'bold',
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Soch raha hai...' : 'Why?'}
              </button>

              {explanation && (
                <div style={{ marginTop: 12, padding: 12, background: '#0E1117', borderRadius: 6, borderLeft: '3px solid #7FB6A8' }}>
                  <ReactMarkdown>{explanation}</ReactMarkdown>
                </div>
              )}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
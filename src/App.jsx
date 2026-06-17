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

  const data = useMemo(() => {
    try {
      const compiled = math.compile(expr);
      const points = [];
      for (let x = -10; x <= 10; x += 0.1) {
        let y;
        try {
          const cleanX = Math.round(x * 1000) / 1000;
          y = compiled.evaluate({ x: cleanX });
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

  const insights = useMemo(() => analyzeFunction(data), [data]);

  const askWhy = async () => {
    setLoading(true);
    setExplanation('');
    try {
      const prompt = `Ek student ne function f(x) = ${expr} ke baare mein ye numerical insights nikale hain (calculated, not guessed):

${JSON.stringify(insights, null, 2)}

In facts ko use karke, Hinglish (Hindi+English mix) mein samjhao ki:
- Symmetry jo bataya gaya hai, wo kyu hai (mathematical reason do)
- Turning points ka matlab kya hai is function ke liye
- Increasing/decreasing behavior ka kya matlab hai
${insights.isDiscontinuous ? '- Ye function discontinuous hai, is baat ka bhi mention karo aur student ko batao ki insights carefully interpret karni chahiye.' : ''}

Sirf in diye gaye facts ko explain karo, naye facts mat banao. Concise raho, 4-5 sentences, tutor jaisa tone.
format your answer using markdown.
use headings and bullet points where useful.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`,
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
              <LineChart data={data}>
                <CartesianGrid stroke="#2C313D" strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  stroke="#888"
                  ticks={[-10,-8,-6,-4,-2,0,2,4,6,8,10]}
                />
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

            <div><strong>Domain:</strong> {insights.domain}</div>
            <div><strong>Range:</strong> [{insights.range?.min}, {insights.range?.max}]</div>

            <div>
              <strong>Symmetry:</strong> {insights.symmetry}
              {insights.symmetryConfidence > 0 && (
                <span style={{ color: '#9C9890' }}> ({insights.symmetryConfidence}% confidence)</span>
              )}
            </div>

            {insights.isDiscontinuous && (
              <div style={{ marginTop: 8, color: '#E0A458', fontSize: 12 }}>
                ⚠️ Discontinuous function detected
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <strong>Increasing on:</strong>
              {insights.increasingRegions?.length
                ? insights.increasingRegions.map((r, i) => <div key={i}>({r[0]}, {r[1]})</div>)
                : ' none'}
            </div>

            <div style={{ marginTop: 10 }}>
              <strong>Decreasing on:</strong>
              {insights.decreasingRegions?.length
                ? insights.decreasingRegions.map((r, i) => <div key={i}>({r[0]}, {r[1]})</div>)
                : ' none'}
            </div>

            <div style={{ marginTop: 10 }}>
              <strong>Turning points:</strong>
              {insights.turningPoints?.length
                ? insights.turningPoints.map((p, i) => <div key={i}>({p[0]}, {p[1]})</div>)
                : ' none'}
            </div>

            {insights.undefinedRegions?.length > 0 && (
              <div style={{ marginTop: 10, color: '#E0A458' }}>
                <strong>Undefined on:</strong>
                {insights.undefinedRegions.map((r, i) => <div key={i}>({r[0]}, {r[1]})</div>)}
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
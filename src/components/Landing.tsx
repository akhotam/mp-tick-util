import { useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  onDemo: () => void;
  busy: boolean;
  error: string | null;
}

export function Landing({ onFiles, onDemo, busy, error }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="landing">
      <h2>See what your climbing looks like</h2>
      <p>
        Drop your Mountain Project tick exports below for grade pyramids, activity over time, the
        places you climb and who you climb with.
      </p>

      <div
        className={over ? 'dropzone over' : 'dropzone'}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFiles([...e.dataTransfer.files]);
        }}
      >
        <strong>{busy ? 'Merging…' : 'Drop your CSV exports here'}</strong>
        <div className="hint">
          Drop as many as you have — they merge into one logbook, newest export winning.
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn" onClick={() => input.current?.click()}>
            Choose files
          </button>
          <button className="btn ghost" onClick={onDemo}>
            View demo logbook
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,.json"
          multiple
          hidden
          onChange={(e) => onFiles([...(e.target.files ?? [])])}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <ol className="steps">
        <li>
          <span className="n">1</span>
          <span>
            On Mountain Project, open your profile and choose <strong>Ticks</strong>, then{' '}
            <strong>Export CSV</strong>.
          </span>
        </li>
        <li>
          <span className="n">2</span>
          <span>Drop the file here. Old exports are welcome too — more history, more to see.</span>
        </li>
        <li>
          <span className="n">3</span>
          <span>
            Download the merged <code>logbook.json</code> when you're done. Drop it back next time
            alongside a fresh export to pick up where you left off.
          </span>
        </li>
      </ol>

      <p className="privacy">
        Everything happens in this tab. Your ticks are never uploaded, stored or sent anywhere —
        close the page and nothing of yours remains.
      </p>
    </div>
  );
}

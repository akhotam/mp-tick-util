function Landing({ onFiles, onDemo }: { onFiles: (files: File[]) => void; onDemo: () => void }) {
  return (
    <>
      <div className="page-title">
        <p className="lead">
          Merge your Mountain Project tick exports into one durable <code>logbook.json</code> and
          view your climbing analytics. Everything runs in your browser, with no accounts and no uploads.
        </p>
      </div>
      <div className="row">
        <section className="col-main">
          <h2>Get started</h2>
          <div className="choices">
            <div className="panel choice">
              <h3>Upload files</h3>
              <p>
                Select one or more tick CSV exports, plus your existing logbook.json if you have one. You can
                also drop files anywhere on this page.
              </p>
              <label className="btn btn-primary">
                Choose files
                <input className="visually-hidden" type="file" multiple accept=".csv,.json" onChange={(e) => {
                  onFiles([...(e.target.files ?? [])])
                  e.target.value = ''
                }} />
              </label>
            </div>
            <div className="panel choice">
              <h3>View demo logbook</h3>
              <p>Explore the charts with a sample logbook before using your own ticks.</p>
              <button className="btn btn-primary" type="button" onClick={onDemo}>
                View demo
              </button>
            </div>
          </div>
        </section>
        <section className="col-side">
          <h2>How to use</h2>
          <ol className="steps">
            <li>
              On Mountain Project, open your profile, go to <strong>Ticks</strong>, and click{' '}
              <strong>Export CSV</strong>.
            </li>
            <li>
              Click <strong>Choose files</strong> and select the CSV. Add your previous{' '}
              <code>logbook.json</code> to merge new ticks into it.
            </li>
            <li>
              Download the merged <code>logbook.json</code> and keep it somewhere safe. It is your
              durable record, even if ticks change on Mountain Project.
            </li>
            <li>Browse charts of your ticks by date, grade, and style.</li>
          </ol>
          <p className="text-muted">
            Your files never leave your browser. Closing the tab discards everything except the
            logbook.json you download.
          </p>
        </section>
      </div>
    </>
  )
}

export default Landing

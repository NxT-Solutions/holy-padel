const basePath: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const screenshots = [
  {
    src: "01-score-every-rally.png",
    alt: "Live scoring screen with large rally buttons",
  },
  {
    src: "03-watch-mirroring.png",
    alt: "Phone and watch live score mirroring",
  },
  {
    src: "05-private-match-ledger.png",
    alt: "Private match ledger screen",
  },
  {
    src: "06-know-your-form.png",
    alt: "Player profile and form screen",
  },
];

const features = [
  ["FIP-aware scoring", "Advantage, golden point, tie-breaks, super tie-breaks, partial saves."],
  ["Local-first ledger", "SQLite keeps match setup and point events on the device by default."],
  ["Wrist-ready", "Apple Watch and Wear OS mirror the phone and send simple intents back."],
  [
    "Workout optional",
    "Write completed matches to Apple Health or Health Connect when you choose.",
  ],
] as const;

const systemSteps = [
  "Start with teams, format, first serve, and court context.",
  "Append each rally as a point event.",
  "Fold the event stream through the pure scoring engine.",
  "Render the phone UI and mirror the state to watches.",
  "Save the final or partial result in the local ledger.",
] as const;

function asset(path: string): string {
  return `${basePath}${path}`;
}

export default function Home() {
  return (
    <main>
      <section className="hero">
        <nav className="nav" aria-label="Primary">
          <a className="brand" href="#top" aria-label="Holy Padel home">
            <img src={asset("/assets/brand/logo-mark.svg")} alt="" />
            <span>Holy Padel</span>
          </a>
          <div className="links">
            <a href="#features">Features</a>
            <a href="#system">System</a>
            <a href="https://github.com/NxT-Solutions/holy-padel">GitHub</a>
          </div>
        </nav>

        <div className="heroGrid" id="top">
          <div className="heroCopy">
            <p className="eyebrow">Local-first padel scoring</p>
            <h1>Score every rally. Keep the whole match yours.</h1>
            <p className="lede">
              Holy Padel is an open-source score tracker for phone, Apple Watch, and Wear OS. It
              understands real padel formats, keeps matches on device by default, and treats watches
              as mirrors rather than second scorekeepers.
            </p>
            <div className="actions">
              <a className="primaryAction" href="https://github.com/NxT-Solutions/holy-padel">
                View on GitHub
              </a>
              <a className="secondaryAction" href="#system">
                See how it works
              </a>
            </div>
          </div>

          <div className="deviceWall">
            {screenshots.map((shot, index) => (
              <img
                className={`phoneShot phoneShot${String(index + 1)}`}
                key={shot.src}
                src={asset(`/assets/screenshots/${shot.src}`)}
                alt={shot.alt}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="band" id="features">
        <div className="sectionHead">
          <p className="eyebrow">Built for club matches</p>
          <h2>Fast enough for court time, strict enough for the rules.</h2>
        </div>
        <div className="featureGrid">
          {features.map(([title, text]) => (
            <article className="feature" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="system" id="system">
        <div className="systemCopy">
          <p className="eyebrow">One source of truth</p>
          <h2>The phone owns the match. Watches help.</h2>
          <p>
            Every point is stored as an event. The scoring engine folds those events into the
            current snapshot: points, games, sets, server, and match moment. Undo removes the latest
            event and recomputes.
          </p>
        </div>
        <ol className="steps">
          {systemSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="ledger">
        <img
          src={asset("/assets/screenshots/02-live-match-hub.png")}
          alt="Home screen showing a live match hub"
        />
        <div>
          <p className="eyebrow">Private by default</p>
          <h2>No account needed. No cloud required.</h2>
          <p>
            Matches live in a local SQLite ledger. Health logging is opt-in and write-only. The
            default experience is simple: play, score, save, review.
          </p>
        </div>
      </section>
    </main>
  );
}

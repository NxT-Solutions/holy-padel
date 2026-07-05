const basePath: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const courtSignals = [
  ["Local first", "No account or cloud hand-off needed to score a match."],
  ["FIP formats", "Advantage, golden point, tie-breaks, super tie-breaks."],
  ["Watch mirrors", "Phone owns the truth while wrists stay glanceable."],
] as const;

const showcases = [
  {
    kicker: "Live scoring",
    title: "Big taps for sweaty hands and fast rallies.",
    text: "The scoring screen stays brutally clear: who served, who won the point, what the match moment is, and how to undo without breaking flow.",
    src: "01-live-scoring.png",
    alt: "Holy Padel live scoring screen with large player score tiles.",
  },
  {
    kicker: "Match memory",
    title: "Every session becomes a private ledger.",
    text: "Finished and partial matches stay on device by default, so players can review recent results without creating an account first.",
    src: "04-matches.png",
    alt: "Holy Padel matches screen showing recent padel results.",
  },
  {
    kicker: "Form check",
    title: "Stats that feel useful before the next serve.",
    text: "Player profiles surface win rate, recent results, partners, and head-to-head context without turning club padel into spreadsheet homework.",
    src: "06-profile.png",
    alt: "Holy Padel player profile screen with form and match stats.",
  },
] as const;

const systemSteps = [
  "Choose teams, format, server, and court context.",
  "Append each rally as a point event.",
  "Fold events through the pure scoring engine.",
  "Mirror the snapshot to Apple Watch and Wear OS.",
  "Save the final or partial result locally.",
] as const;

function asset(path: string): string {
  return `${basePath}${path}`;
}

export default function Home() {
  return (
    <main id="top">
      <section className="hero">
        <div className="courtLines" aria-hidden="true" />
        <nav className="nav" aria-label="Primary">
          <a className="brand" href="#top" aria-label="Holy Padel home">
            <img src={asset("/assets/brand/logo-mark.svg")} alt="" />
            <span>Holy Padel</span>
          </a>
          <div className="links">
            <a href="#features">Features</a>
            <a href="#system">System</a>
            <a href="#github">GitHub</a>
          </div>
        </nav>

        <div className="heroGrid">
          <div className="heroCopy">
            <p className="eyebrow">Local-first padel scoring</p>
            <h1>
              Score the match.
              <span>Keep the rhythm.</span>
            </h1>
            <p className="lede">
              Holy Padel is an open-source score tracker for phone, Apple Watch, and Wear OS. It
              understands real padel formats, keeps matches on device by default, and gives every
              rally the same crisp feedback as a scoreboard on court.
            </p>
            <div className="actions">
              <a className="primaryAction" href="https://github.com/NxT-Solutions/holy-padel">
                View on GitHub
              </a>
              <a className="secondaryAction" href="#features">
                Explore the app
              </a>
            </div>
          </div>

          <div className="heroVisual">
            <div className="rallyPuck" aria-hidden="true">
              <span>Game point</span>
              <strong>Nico &amp; Javi</strong>
            </div>
            <div className="ballArc" aria-hidden="true" />
            <img
              className="heroPhone heroPhoneMain"
              src={asset("/assets/screenshots/01-live-scoring.png")}
              alt="Holy Padel live scoring screen"
            />
            <img
              className="heroPhone heroPhoneSide"
              src={asset("/assets/screenshots/03-match-won.png")}
              alt="Holy Padel match won screen"
            />
            <div className="watchFloat">
              <img
                src={asset("/assets/screenshots/watch-live.png")}
                alt="Holy Padel Apple Watch live score screen"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="signalStrip" aria-label="Holy Padel highlights">
        {courtSignals.map(([title, text]) => (
          <article className="signal" key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="showcase" id="features">
        <div className="sectionHead">
          <p className="eyebrow">Built for club chaos</p>
          <h2>Everything visible at match speed.</h2>
          <p>
            Clean app screenshots, zero store-poster noise. The site now shows what players really
            touch when the score matters.
          </p>
        </div>

        <div className="showcaseRows">
          {showcases.map((shot, index) => (
            <article
              className={`showcaseRow ${index % 2 === 1 ? "showcaseRowReverse" : ""}`}
              key={shot.src}
            >
              <div className="showcaseCopy">
                <p className="eyebrow">{shot.kicker}</p>
                <h3>{shot.title}</h3>
                <p>{shot.text}</p>
              </div>
              <div className="phoneFrame">
                <img src={asset(`/assets/screenshots/${shot.src}`)} alt={shot.alt} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="system" id="system">
        <div className="systemCopy">
          <p className="eyebrow">One source of truth</p>
          <h2>The phone owns the match. Watches help.</h2>
          <p>
            Every point is stored as an event. Undo drops the latest event. The scoring engine folds
            that stream into the current snapshot, then the phone UI and watches render from the
            same state.
          </p>
        </div>
        <ol className="steps">
          {systemSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="openSource" id="github">
        <div>
          <p className="eyebrow">Open source with a serious engine</p>
          <h2>FIP scoring in TypeScript, mirrored to Swift and Kotlin.</h2>
          <p>
            The scoring package is pure and event-sourced. Native ports stay aligned through golden
            vectors, while the app remains local-first for real players and useful for contributors.
          </p>
        </div>
        <a className="primaryAction" href="https://github.com/NxT-Solutions/holy-padel">
          Read the repo
        </a>
      </section>
    </main>
  );
}

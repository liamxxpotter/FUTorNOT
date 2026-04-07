export default function About() {
  return (
    <div className="about">

      <div className="about-hero">
        <h1 className="about-title">About FUTorNOT</h1>
        <p className="about-lead">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
          exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </p>
      </div>

      <section className="about-section">
        <h2 className="about-section-title">How it works</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
          mollit anim id est laborum.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
          laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
          architecto beatae vitae dicta sunt explicabo.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-section-title">FAQ</h2>

        <details className="faq-item">
          <summary className="faq-question">Lorem ipsum dolor sit amet?</summary>
          <p className="faq-answer">
            Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
            magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
          </p>
        </details>

        <details className="faq-item">
          <summary className="faq-question">Ut enim ad minim veniam, quis nostrud?</summary>
          <p className="faq-answer">
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
            fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.
          </p>
        </details>

        <details className="faq-item">
          <summary className="faq-question">Quis custodiet ipsos custodes?</summary>
          <p className="faq-answer">
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
            doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore.
          </p>
        </details>

        <details className="faq-item">
          <summary className="faq-question">Nemo enim ipsam voluptatem quia voluptas?</summary>
          <p className="faq-answer">
            Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,
            adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore.
          </p>
        </details>

        <details className="faq-item">
          <summary className="faq-question">At vero eos et accusamus et iusto odio?</summary>
          <p className="faq-answer">
            Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo
            minus id quod maxime placeat facere possimus, omnis voluptas assumenda est.
          </p>
        </details>
      </section>

    </div>
  )
}

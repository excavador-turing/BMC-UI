/**
 * Who made this, in both applications.
 *
 * Upstream's copyright is required. The fork's is beside it because nothing
 * in this interface said which one it was -- a screenshot in a bug report was
 * indistinguishable from upstream's.
 *
 * Its own component because the fleet is a separate entry point built from
 * this same tree: it never renders the board's root route, so it had no
 * footer at all, and the attribution that exists for a legal reason was
 * missing from one of the two things this repository ships.
 */
export default function SiteFooter() {
  return (
    <footer className="flex flex-wrap justify-center gap-x-2 gap-y-1 py-4 text-center text-xs uppercase opacity-60">
      <span>© Turing Machines Inc.</span>
      <span aria-hidden>·</span>
      <span>
        fork © Oleg Tsarev{" "}
        <a className="underline" href="mailto:oleg@tsarev.id">
          oleg@tsarev.id
        </a>
      </span>
      <span aria-hidden>·</span>
      <a
        className="underline"
        href="https://github.com/excavador-turing"
        target="_blank"
        rel="noreferrer noopener"
      >
        excavador-turing
      </a>
      <span aria-hidden>·</span>
      {/* turingpi.xyz, not turing.excavador.xyz. That name is dead and this
          link had been pointing at it. */}
      <a
        className="underline"
        href="https://turingpi.xyz"
        target="_blank"
        rel="noreferrer noopener"
      >
        docs
      </a>
    </footer>
  );
}

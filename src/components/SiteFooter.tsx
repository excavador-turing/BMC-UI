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
    <footer className="flex flex-wrap justify-center gap-x-2 gap-y-1 py-4 text-center text-xs text-muted-foreground">
      <span>© Turing Machines Inc.</span>
      <span aria-hidden>·</span>
      <span>
        fork © Oleg Tsarev{" "}
        <a className="underline" href="mailto:oleg@tsarev.id">
          oleg@tsarev.id
        </a>
      </span>
    </footer>
  );
}

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches a render error in its subtree and shows `fallback` instead.
 *
 * React offers no hook for this: catching requires a class, which is why this
 * file is the only class component in the application.
 *
 * It exists because `<Suspense>` does not do this job. Suspense handles a
 * *pending* promise; a *rejected* one is thrown during render and passes
 * straight through it. `BasicInfo` is a `useSuspenseQuery` mounted in the
 * header of every route, and it had a bare `<Suspense>` around it -- so a
 * single failing `type=about` unwound past the header, past the route, and
 * past the root, none of which had a boundary, and blanked the whole
 * application. A daemon that is briefly busy should cost the header, not the
 * page someone is working on.
 *
 * Deliberately local rather than a dependency: it is twenty lines, and the
 * alternative was a package on the critical path of every page.
 */
interface Props {
  children: ReactNode;
  fallback: ReactNode;
  /** Named in the console line, so a report says which subtree failed. */
  label?: string;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Swallowing this would make the fallback the only evidence, and the
    // fallback is deliberately quiet.
    console.error(
      `[${this.props.label ?? "ErrorBoundary"}] render failed:`,
      error,
      info.componentStack
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default ErrorBoundary;

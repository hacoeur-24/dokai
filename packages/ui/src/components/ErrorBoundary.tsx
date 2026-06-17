import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single broken doc or diagram doesn't take down the whole shell.
 * Errors bubble up to the console for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('DOKAI render error:', error, info);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const { fallback } = this.props;
    if (fallback) return fallback(this.state.error, this.reset);
    return (
      <div
        className="m-4 rounded-card border p-5"
        style={{ borderColor: 'var(--color-danger)' }}
        role="alert"
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-danger)' }}>
          Something went wrong
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 rounded-control border px-3 py-1.5 text-sm hover:bg-bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }
}

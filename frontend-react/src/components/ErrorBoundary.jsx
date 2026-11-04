import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Card } from "./ui";

/** Last line of defence: a render error in one view shows a recoverable message instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card role="alert" className="flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-danger-bg text-danger"><AlertTriangle className="size-6" aria-hidden="true" /></span>
        <h2 className="text-lg font-semibold">This view hit an unexpected error</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{this.state.error.message}</p>
        <Button className="mt-5" variant="primary" onClick={() => this.setState({ error: null })}>Try again</Button>
      </Card>
    );
  }
}

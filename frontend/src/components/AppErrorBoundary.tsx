import React, { ErrorInfo, ReactNode } from 'react';
import { ApiFailure } from './RouteStates';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Engineer Kingdom interface error', error, info); }
  render() {
    if (this.state.hasError) return <ApiFailure title="This page could not be displayed" message="An unexpected interface error occurred. Reload the page to recover your session." />;
    return this.props.children;
  }
}

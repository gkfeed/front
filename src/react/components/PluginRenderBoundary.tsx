import { Component, type ErrorInfo, type ReactNode } from 'react';

export class PluginRenderBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  pluginId: string;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Plugin renderer failed: ${this.props.pluginId}`, error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

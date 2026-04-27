import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2>Etwas ist schiefgelaufen</h2>
          <pre style={{ color: 'red', fontSize: 12 }}>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })}>Neu laden</button>
        </div>
      )
    }
    return this.props.children
  }
}

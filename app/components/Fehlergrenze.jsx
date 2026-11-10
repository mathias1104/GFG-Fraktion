'use client';
import { Component } from 'react';

export function meldeFehler(e, ort) {
  try {
    fetch('/api/fehler', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meldung: e?.message || String(e), stack: e?.stack || '', ort: ort || window.location.hash }),
    });
  } catch { /* egal */ }
}

/** Fängt Anzeigefehler ab, damit nicht die ganze App verschwindet */
export default class Fehlergrenze extends Component {
  constructor(props) { super(props); this.state = { fehler: null }; }
  static getDerivedStateFromError(fehler) { return { fehler }; }
  componentDidCatch(fehler) { meldeFehler(fehler, `${this.props.ort || ''} ${window.location.hash}`); }
  componentDidUpdate(prev) { if (prev.ort !== this.props.ort && this.state.fehler) this.setState({ fehler: null }); }
  render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <div className="hinweis fehler" role="alert" style={{ marginTop: 16 }}>
        <b>Dieser Bereich konnte nicht angezeigt werden.</b>
        <p style={{ marginTop: 6 }}>Fehler: {String(this.state.fehler?.message || this.state.fehler)}</p>
        <button className="knopf klein" style={{ marginTop: 10 }} onClick={() => this.setState({ fehler: null })}>Nochmal versuchen</button>
      </div>
    );
  }
}

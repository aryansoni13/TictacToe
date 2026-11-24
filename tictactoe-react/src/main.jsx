import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// If something unexpected breaks the screen, show a message and a reload button instead of a blank page.
class Boundary extends Component {
    state = { err: null };
    static getDerivedStateFromError(err) { return { err }; }
    render() {
        if (!this.state.err) return this.props.children;
        return (
            <main className="app">
                <section className="panel">
                    <h2>Something went wrong</h2>
                    <p className="err">{String(this.state.err.message || this.state.err)}</p>
                    <button className="btn primary" onClick={() => location.reload()}>Reload</button>
                </section>
            </main>
        );
    }
}

createRoot(document.getElementById('root')).render(<Boundary><App /></Boundary>);

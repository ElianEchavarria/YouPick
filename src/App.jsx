import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Session from "./pages/Session.jsx";

// Two pages: "/" to start a decision, "/s/:id" for everything after that.
// ":id" is a URL parameter; Session reads it with useParams().
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:id" element={<Session />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <main className="page">
      <div className="card center">
        <h1>Page not found</h1>
        <Link className="button" to="/">
          Start a decision
        </Link>
      </div>
    </main>
  );
}

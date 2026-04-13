import { Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";

function App() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex gap-4 border-b border-gray-200 bg-white px-6 py-3">
        <Link to="/" className="font-medium hover:text-blue-600">
          Home
        </Link>
        <Link to="/about" className="font-medium hover:text-blue-600">
          About
        </Link>
      </nav>
      <div className="px-6 py-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </main>
  );
}

export default App;

import { HashRouter, Link, Route, Routes } from "react-router-dom";

import CourseList from "./pages/CourseList";
import CourseDetail from "./pages/CourseDetail";
import SectionDetail from "./pages/SectionDetail";

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold">
              Personal LMS
            </Link>
            <nav className="text-sm text-slate-400">
              <Link to="/" className="hover:text-slate-100">
                Courses
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<CourseList />} />
            <Route path="/courses/:courseId" element={<CourseDetail />} />
            <Route
              path="/courses/:courseId/sections/:sectionId"
              element={<SectionDetail />}
            />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

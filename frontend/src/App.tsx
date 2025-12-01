import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import PaperExplorer from './components/PaperExplorer';
import AuthorRanking from './components/AuthorRanking';
import AllPapersStatistics from './components/AllPapersStatistics';
import './App.css';

const NavLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`app-nav-link ${isActive ? 'active' : ''}`}>
      {children}
    </Link>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="App">
        <nav className="app-nav">
          <NavLink to="/">論文検索</NavLink>
          <NavLink to="/authors">著者情報</NavLink>
          <NavLink to="/all_papers">全論文統計情報</NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<PaperExplorer />} />
          <Route path="/authors" element={<AuthorRanking />} />
          <Route path="/all_papers" element={<AllPapersStatistics />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;


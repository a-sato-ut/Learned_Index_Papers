import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthorRankingItem } from '../types';
import './AuthorRanking.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

type SortBy = 'paperCount' | 'totalCitations';

const AuthorRanking: React.FC = () => {
  const navigate = useNavigate();
  const [ranking, setRanking] = useState<AuthorRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('paperCount');

  useEffect(() => {
    fetchRanking();
  }, [sortBy]);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/authors/ranking?sort_by=${sortBy}`);
      if (response.ok) {
        const data = await response.json();
        setRanking(data.ranking || []);
      } else {
        console.error('Failed to fetch author ranking');
      }
    } catch (error) {
      console.error('Error fetching author ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="author-ranking">
        <div className="author-ranking-loading">
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="author-ranking">
      <div className="author-ranking-header">
        <h1>📊 著者ランキング</h1>
        <div className="author-ranking-sort">
          <label>ソート:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="paperCount">論文数順</option>
            <option value="totalCitations">被引用数順</option>
          </select>
        </div>
      </div>

      <div className="author-ranking-list">
        {ranking.map((author, index) => (
          <div key={author.author} className="author-ranking-item">
            <div className="author-ranking-item-header">
              <div className="author-ranking-item-rank">#{index + 1}</div>
              <div 
                className="author-ranking-item-name author-clickable"
                onClick={() => navigate(`/?authors=${encodeURIComponent(author.author)}`)}
              >
                {author.author}
              </div>
              <div className="author-ranking-item-stats">
                <span className="author-stat">
                  <span className="author-stat-label">論文数:</span>
                  <span className="author-stat-value">{author.paperCount}</span>
                </span>
                <span className="author-stat">
                  <span className="author-stat-label">被引用数:</span>
                  <span className="author-stat-value">{author.totalCitations}</span>
                </span>
              </div>
            </div>

            {author.tags.length > 0 && (
              <div className="author-ranking-item-section">
                <h3 className="author-ranking-item-section-title">タグ</h3>
                <div className="author-ranking-item-tags">
                  {author.tags.map((tagStat, tagIndex) => (
                    <span 
                      key={tagIndex} 
                      className="author-tag author-tag-clickable"
                      onClick={() => navigate(`/?authors=${encodeURIComponent(author.author)}&tags=${encodeURIComponent(tagStat.tag)}`)}
                    >
                      {tagStat.tag} ({tagStat.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {author.conferences.length > 0 && (
              <div className="author-ranking-item-section">
                <h3 className="author-ranking-item-section-title">カンファレンス</h3>
                <div className="author-ranking-item-conferences">
                  {author.conferences.map((confStat, confIndex) => (
                    <span 
                      key={confIndex} 
                      className="author-conference author-conference-clickable"
                      onClick={() => navigate(`/?authors=${encodeURIComponent(author.author)}&venues=${encodeURIComponent(confStat.conference)}`)}
                    >
                      {confStat.conference} ({confStat.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {author.affiliations && author.affiliations.length > 0 && (
              <div className="author-ranking-item-section">
                <h3 className="author-ranking-item-section-title">所属</h3>
                <div className="author-ranking-item-affiliations">
                  {author.affiliations.map((aff, affIndex) => {
                    const years = aff.years || [];
                    const minYear = years.length > 0 ? Math.min(...years) : null;
                    const maxYear = years.length > 0 ? Math.max(...years) : null;
                    const yearDisplay = minYear === maxYear 
                      ? `(${minYear})` 
                      : minYear && maxYear
                      ? `(${minYear} - ${maxYear})`
                      : years.length > 0
                      ? `(${years.join(", ")})`
                      : "";
                    
                    return (
                      <div key={affIndex} className="author-affiliation">
                        <span className="author-affiliation-name">{aff.name}</span>
                        {yearDisplay && (
                          <span className="author-affiliation-years">{yearDisplay}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthorRanking;


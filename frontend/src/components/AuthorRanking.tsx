import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthorRankingItem } from '../types';
import './AuthorRanking.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

type SortBy = 'paperCount' | 'totalCitations';

const AuthorRanking: React.FC = () => {
  const navigate = useNavigate();
  const [ranking, setRanking] = useState<AuthorRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('paperCount');
  const [expandedAffiliations, setExpandedAffiliations] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [minYear, setMinYear] = useState<number | null>(null);
  const [appliedMinYear, setAppliedMinYear] = useState<number | null>(null);

  useEffect(() => {
    fetchRanking();
    setCurrentPage(1); // ソート変更時にページをリセット
  }, [sortBy, appliedMinYear]);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/authors/ranking?sort_by=${sortBy}`;
      if (appliedMinYear !== null) {
        url += `&min_year=${appliedMinYear}`;
      }
      const response = await fetch(url);
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

  const handleApplyFilter = () => {
    setAppliedMinYear(minYear);
    setCurrentPage(1);
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
        <div className="author-ranking-controls">
          <div className="author-ranking-sort">
            <label>ソート:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="paperCount">論文数順</option>
              <option value="totalCitations">被引用数順</option>
            </select>
          </div>
          <div className="author-ranking-year-filter">
            <label>年フィルタ:</label>
            <input
              type="number"
              placeholder="年"
              min="1900"
              max={new Date().getFullYear()}
              value={minYear || ''}
              onChange={(e) => {
                const value = e.target.value;
                setMinYear(value === '' ? null : parseInt(value, 10));
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleApplyFilter();
                }
              }}
              className="author-ranking-year-input"
            />
            <span className="author-ranking-year-label">以降の論文のみ集計</span>
            <button
              className="author-ranking-year-apply"
              onClick={handleApplyFilter}
            >
              フィルタ
            </button>
            {appliedMinYear !== null && (
              <button
                className="author-ranking-year-clear"
                onClick={() => {
                  setMinYear(null);
                  setAppliedMinYear(null);
                }}
              >
                クリア
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="author-ranking-list">
        {(() => {
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const currentRanking = ranking.slice(startIndex, endIndex);
          const totalPages = Math.ceil(ranking.length / itemsPerPage);
          
          return (
            <>
              {currentRanking.map((author, index) => (
          <div key={author.author} className="author-ranking-item">
            <div className="author-ranking-item-header">
              <div className="author-ranking-item-rank">#{startIndex + index + 1}</div>
              <Link
                to={`/?authors=${encodeURIComponent(author.author)}`}
                className="author-ranking-item-name author-clickable"
              >
                {author.author}
              </Link>
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
                    <Link
                      key={tagIndex}
                      to={`/?authors=${encodeURIComponent(author.author)}&tags=${encodeURIComponent(tagStat.tag)}`}
                      className="author-tag author-tag-clickable"
                    >
                      {tagStat.tag} ({tagStat.count})
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {author.conferences.length > 0 && (
              <div className="author-ranking-item-section">
                <h3 className="author-ranking-item-section-title">カンファレンス</h3>
                <div className="author-ranking-item-conferences">
                  {author.conferences.map((confStat, confIndex) => (
                    <Link
                      key={confIndex}
                      to={`/?authors=${encodeURIComponent(author.author)}&venues=${encodeURIComponent(confStat.conference)}`}
                      className="author-conference author-conference-clickable"
                    >
                      {confStat.conference} ({confStat.count})
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {author.affiliations && author.affiliations.length > 0 && (
              <div className="author-ranking-item-section">
                <h3 className="author-ranking-item-section-title">所属</h3>
                <div className="author-ranking-item-affiliations">
                  {(() => {
                    // 最新の年でソート（新しい順）
                    const sortedAffiliations = [...author.affiliations].sort((a, b) => {
                      const aMaxYear = a.years && a.years.length > 0 ? Math.max(...a.years) : 0;
                      const bMaxYear = b.years && b.years.length > 0 ? Math.max(...b.years) : 0;
                      return bMaxYear - aMaxYear;
                    });
                    
                    const isExpanded = expandedAffiliations.has(author.author);
                    const displayAffiliations = isExpanded 
                      ? sortedAffiliations 
                      : sortedAffiliations.slice(0, 5);
                    const hasMore = sortedAffiliations.length > 5;
                    
                    return (
                      <>
                        {displayAffiliations.map((aff, affIndex) => {
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
                        {hasMore && (
                          <button
                            className="author-affiliation-expand-btn"
                            onClick={() => {
                              const newExpanded = new Set(expandedAffiliations);
                              if (isExpanded) {
                                newExpanded.delete(author.author);
                              } else {
                                newExpanded.add(author.author);
                              }
                              setExpandedAffiliations(newExpanded);
                            }}
                          >
                            {isExpanded ? '折りたたむ' : `+${sortedAffiliations.length - 5}件を表示`}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
              ))}
              
              {ranking.length > itemsPerPage && (
                <div className="author-ranking-pagination">
                  <button
                    className="author-ranking-pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    前へ
                  </button>
                  <span className="author-ranking-pagination-info">
                    ページ {currentPage} / {totalPages} ({ranking.length}人中 {startIndex + 1}-{Math.min(endIndex, ranking.length)}を表示)
                  </span>
                  <button
                    className="author-ranking-pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default AuthorRanking;


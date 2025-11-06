import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as d3 from 'd3';
import { AuthorRankingItem } from '../types';
import './AuthorRanking.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

// 円グラフの共通ハイパーパラメータ
const PIE_CHART_CONFIG = {
  topN: 40, // 上位何件を表示するか
  width: 600,
  pieRadius: 120,
  pieHeight: 300,
  legendItemHeight: 22,
  legendColumns: 1,
  legendColumnWidth: 280,
  maxTextLength: 50, // 凡例のテキストの最大文字数
};

type SortBy = 'paperCount' | 'totalCitations';

const AuthorStatisticsSection: React.FC<{ authors: AuthorRankingItem[] }> = ({ authors }) => {
  const affiliationStatsRef = useRef<SVGSVGElement>(null);
  const tagStatsRef = useRef<SVGSVGElement>(null);
  const conferenceStatsRef = useRef<SVGSVGElement>(null);
  const currentYear = 2025;

  useEffect(() => {
    if (!authors || authors.length === 0) return;

    // 2025年時点での所属統計を計算
    const affiliationCounts = new Map<string, number>();
    authors.forEach(author => {
      if (author.affiliations && author.affiliations.length > 0) {
        // 2025年を含むyearsを持つ所属、または最新の所属を取得
        const currentAffiliations = author.affiliations.filter(aff => {
          if (!aff.years || aff.years.length === 0) return false;
          const maxYear = Math.max(...aff.years);
          // 2025年を含む、または最新の所属（2025年がデータにない場合のフォールバック）
          return aff.years.includes(currentYear) || maxYear >= currentYear - 1;
        });
        
        // 最新の所属を取得（2025年の所属がない場合）
        if (currentAffiliations.length === 0) {
          const sortedAffiliations = [...author.affiliations].sort((a, b) => {
            const aMaxYear = a.years && a.years.length > 0 ? Math.max(...a.years) : 0;
            const bMaxYear = b.years && b.years.length > 0 ? Math.max(...b.years) : 0;
            return bMaxYear - aMaxYear;
          });
          if (sortedAffiliations.length > 0) {
            currentAffiliations.push(sortedAffiliations[0]);
          }
        }

        currentAffiliations.forEach(aff => {
          affiliationCounts.set(aff.name, (affiliationCounts.get(aff.name) || 0) + 1);
        });
      }
    });

    // タグ統計を計算
    const tagCounts = new Map<string, number>();
    authors.forEach(author => {
      if (author.tags) {
        author.tags.forEach(tagStat => {
          tagCounts.set(tagStat.tag, (tagCounts.get(tagStat.tag) || 0) + tagStat.count);
        });
      }
    });

    // カンファレンス統計を計算
    const conferenceCounts = new Map<string, number>();
    authors.forEach(author => {
      if (author.conferences) {
        author.conferences.forEach(confStat => {
          conferenceCounts.set(confStat.conference, (conferenceCounts.get(confStat.conference) || 0) + confStat.count);
        });
      }
    });

    // 所属円グラフを描画
    if (affiliationStatsRef.current && affiliationCounts.size > 0) {
      const svg = d3.select(affiliationStatsRef.current);
      svg.selectAll('*').remove();

      const sortedAffiliations = Array.from(affiliationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, PIE_CHART_CONFIG.topN);

      const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
      const legendRows = Math.ceil(sortedAffiliations.length / legendColumns);
      const legendHeight = legendRows * legendItemHeight;
      const totalHeight = pieHeight + legendHeight + 40;

      svg
        .attr('width', width)
        .attr('height', totalHeight);

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

      const pie = d3.pie<[string, number]>()
        .value(d => d[1])
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
        .innerRadius(0)
        .outerRadius(pieRadius);

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      const arcs = g
        .selectAll('.arc')
        .data(pie(sortedAffiliations))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(_event, _d) {
          d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function(_event, _d) {
          d3.select(this).attr('opacity', 1);
        });

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

      sortedAffiliations.forEach((aff, i) => {
        const col = i % legendColumns;
        const row = Math.floor(i / legendColumns);
        const x = col * legendColumnWidth;
        const y = row * legendItemHeight;

        const legendRow = legend
          .append('g')
          .attr('transform', `translate(${x}, ${y})`);

        legendRow
          .append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', colorScale(i.toString()))
          .attr('rx', 2);

        const text = legendRow
          .append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(`${aff[0]} (${aff[1]})`);

        if (aff[0].length > PIE_CHART_CONFIG.maxTextLength) {
          text.text(`${aff[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${aff[1]})`);
        }
      });
    }

    // タグ円グラフを描画
    if (tagStatsRef.current && tagCounts.size > 0) {
      const svg = d3.select(tagStatsRef.current);
      svg.selectAll('*').remove();

      const sortedTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, PIE_CHART_CONFIG.topN);

      const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
      const legendRows = Math.ceil(sortedTags.length / legendColumns);
      const legendHeight = legendRows * legendItemHeight;
      const totalHeight = pieHeight + legendHeight + 40;

      svg
        .attr('width', width)
        .attr('height', totalHeight);

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

      const pie = d3.pie<[string, number]>()
        .value(d => d[1])
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
        .innerRadius(0)
        .outerRadius(pieRadius);

      const colorScale = d3.scaleOrdinal(d3.schemeSet2);

      const arcs = g
        .selectAll('.arc')
        .data(pie(sortedTags))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(_event, _d) {
          d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function(_event, _d) {
          d3.select(this).attr('opacity', 1);
        });

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

      sortedTags.forEach((tag, i) => {
        const col = i % legendColumns;
        const row = Math.floor(i / legendColumns);
        const x = col * legendColumnWidth;
        const y = row * legendItemHeight;

        const legendRow = legend
          .append('g')
          .attr('transform', `translate(${x}, ${y})`);

        legendRow
          .append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', colorScale(i.toString()))
          .attr('rx', 2);

        const text = legendRow
          .append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(`${tag[0]} (${tag[1]})`);

        if (tag[0].length > PIE_CHART_CONFIG.maxTextLength) {
          text.text(`${tag[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${tag[1]})`);
        }
      });
    }

    // カンファレンス円グラフを描画
    if (conferenceStatsRef.current && conferenceCounts.size > 0) {
      const svg = d3.select(conferenceStatsRef.current);
      svg.selectAll('*').remove();

      const sortedConferences = Array.from(conferenceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, PIE_CHART_CONFIG.topN);

      const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
      const legendRows = Math.ceil(sortedConferences.length / legendColumns);
      const legendHeight = legendRows * legendItemHeight;
      const totalHeight = pieHeight + legendHeight + 40;

      svg
        .attr('width', width)
        .attr('height', totalHeight);

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

      const pie = d3.pie<[string, number]>()
        .value(d => d[1])
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
        .innerRadius(0)
        .outerRadius(pieRadius);

      const colorScale = d3.scaleOrdinal(d3.schemePastel1);

      const arcs = g
        .selectAll('.arc')
        .data(pie(sortedConferences))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(_event, _d) {
          d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function(_event, _d) {
          d3.select(this).attr('opacity', 1);
        });

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

      sortedConferences.forEach((conf, i) => {
        const col = i % legendColumns;
        const row = Math.floor(i / legendColumns);
        const x = col * legendColumnWidth;
        const y = row * legendItemHeight;

        const legendRow = legend
          .append('g')
          .attr('transform', `translate(${x}, ${y})`);

        legendRow
          .append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', colorScale(i.toString()))
          .attr('rx', 2);

        const text = legendRow
          .append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(`${conf[0]} (${conf[1]})`);

        if (conf[0].length > PIE_CHART_CONFIG.maxTextLength) {
          text.text(`${conf[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${conf[1]})`);
        }
      });
    }
  }, [authors]);

  if (!authors || authors.length === 0) return null;

  const hasAffiliations = authors.some(a => a.affiliations && a.affiliations.length > 0);
  const hasTags = authors.some(a => a.tags && a.tags.length > 0);
  const hasConferences = authors.some(a => a.conferences && a.conferences.length > 0);

  if (!hasAffiliations && !hasTags && !hasConferences) return null;

  return (
    <div className="author-ranking-statistics">
      <h2 className="author-ranking-statistics-title">統計情報（現在表示中の著者）</h2>
      <div className="author-ranking-statistics-content">
        {hasAffiliations && (
          <div className="author-ranking-statistics-chart">
            <h3 className="author-ranking-statistics-chart-title">2025年時点での所属分布</h3>
            <svg ref={affiliationStatsRef} />
          </div>
        )}
        {hasTags && (
          <div className="author-ranking-statistics-chart">
            <h3 className="author-ranking-statistics-chart-title">タグ分布</h3>
            <svg ref={tagStatsRef} />
          </div>
        )}
        {hasConferences && (
          <div className="author-ranking-statistics-chart">
            <h3 className="author-ranking-statistics-chart-title">カンファレンス分布</h3>
            <svg ref={conferenceStatsRef} />
          </div>
        )}
      </div>
    </div>
  );
};

const AuthorRanking: React.FC = () => {
  const [ranking, setRanking] = useState<AuthorRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('paperCount');
  const [expandedAffiliations, setExpandedAffiliations] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [minYear, setMinYear] = useState<number | null>(null);
  const [appliedMinYear, setAppliedMinYear] = useState<number | null>(null);

  const fetchRanking = useCallback(async () => {
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
  }, [sortBy, appliedMinYear]);

  useEffect(() => {
    fetchRanking();
    setCurrentPage(1); // ソート変更時にページをリセット
  }, [fetchRanking]);

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
        <h1>📊 著者情報</h1>
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

      <AuthorStatisticsSection authors={(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return ranking.slice(startIndex, endIndex);
      })()} />
    </div>
  );
};

export default AuthorRanking;


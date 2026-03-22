import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, LogOut, ChevronDown, ChevronUp, Eye, EyeOff, Package, Search, ExternalLink, TrendingUp, Users, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Project, Category } from '../types/project';
import { useAuth } from '../contexts/AuthContext';
import KickstarterStatsUpdater from './KickstarterStatsUpdater';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    fetchProjects();
    fetchCategories();
    window.scrollTo(0, 0);
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      toast.error('カテゴリーの取得に失敗しました。');
      return;
    }

    setCategories(data);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .order('category_id', { ascending: true, nullsFirst: false })
      .order('category_sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('プロジェクトの取得に失敗しました。');
      return;
    }

    setProjects(data);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このプロジェクトを削除してもよろしいですか？')) {
      return;
    }

    const { error } = await supabase.from('projects').delete().eq('id', id);

    if (error) {
      toast.error('プロジェクトの削除に失敗しました。');
      return;
    }

    toast.success('プロジェクトを削除しました。');
    fetchProjects();
  };

  const handleToggleVisibility = async (project: Project) => {
    const { error } = await supabase
      .from('projects')
      .update({ is_public: !project.is_public })
      .eq('id', project.id);

    if (error) {
      toast.error('公開設定の更新に失敗しました。');
      return;
    }

    toast.success(`プロジェクトを${!project.is_public ? '公開' : '非公開'}にしました。`);
    fetchProjects();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
      toast.success('ログアウトしました。');
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '-';
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : '-';
  };

  const toggleProjectDetails = (projectId: string) => {
    setExpandedProject(expandedProject === projectId ? null : projectId);
  };

  const getEmbedUrl = (url: string | null): string | null => {
    if (!url) return null;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('v=')
        ? url.split('v=')[1].split('&')[0]
        : url.split('/').pop();
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (url.includes('vimeo.com')) {
      const videoId = url.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}`;
    }

    return null;
  };

  const filteredProjects = projects.filter((project) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      (project.subtitle && project.subtitle.toLowerCase().includes(query))
    );
  });

  const isKickstarterProject = (project: Project) =>
    project.link_url && project.link_url.includes('kickstarter.com');

  const getAchievementRate = (project: Project) => {
    if (project.target_amount <= 0) return 0;
    const total = project.amount_achieved + project.external_amount_achieved;
    return Math.round((total / project.target_amount) * 100);
  };

  const getAchievementColor = (rate: number) => {
    if (rate >= 100) return 'bg-green-500';
    if (rate >= 50) return 'bg-blue-500';
    if (rate >= 25) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getAchievementTextColor = (rate: number) => {
    if (rate >= 100) return 'text-green-600';
    if (rate >= 50) return 'text-blue-600';
    if (rate >= 25) return 'text-yellow-600';
    return 'text-gray-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              プロジェクト管理
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/projects/new"
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">新規作成</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="プロジェクト名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Stats summary */}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>{filteredProjects.length} プロジェクト</span>
            <span>{filteredProjects.filter(p => p.is_public).length} 公開中</span>
            <span>{filteredProjects.filter(p => isKickstarterProject(p)).length} KS連携</span>
          </div>
        </div>
      </div>

      {/* Project Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-500">
              {searchQuery.trim() ? '検索条件に一致するプロジェクトが見つかりませんでした。' : 'プロジェクトがありません。'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map((project) => {
              const rate = getAchievementRate(project);
              const isExpanded = expandedProject === project.id;
              const isKS = isKickstarterProject(project);
              const totalBuyers = project.buyers_count + project.external_buyers_count;
              const totalAmount = project.amount_achieved + project.external_amount_achieved;

              return (
                <div
                  key={project.id}
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                    project.is_featured
                      ? 'border-indigo-200 ring-1 ring-indigo-100'
                      : !project.is_public
                      ? 'border-gray-200 opacity-60'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Card Main */}
                  <div
                    className="px-4 sm:px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleProjectDetails(project.id)}
                  >
                    {/* Top row: title + badges + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                            {project.title}
                          </h3>
                          {project.is_featured && (
                            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                              Featured
                            </span>
                          )}
                          {!project.is_public && (
                            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                              非公開
                            </span>
                          )}
                          {isKS && (
                            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              KS
                            </span>
                          )}
                        </div>
                        {project.subtitle && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
                            {project.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleVisibility(project)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title={project.is_public ? '非公開にする' : '公開する'}
                        >
                          {project.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <Link
                          to={`/projects/${project.id}/rewards`}
                          className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="リターン管理"
                        >
                          <Package className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/projects/${project.id}/edit`}
                          className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="編集"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-3 flex items-center gap-3 sm:gap-6 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-300"></span>
                        {getCategoryName(project.category_id)}
                      </div>

                      {project.target_amount > 0 && (
                        <>
                          <div className="flex items-center gap-1 text-xs">
                            <Target className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-500">
                              ¥{project.target_amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <TrendingUp className="w-3 h-3 text-gray-400" />
                            <span className="font-medium text-gray-700">
                              ¥{totalAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <Users className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-600">{totalBuyers.toLocaleString()}人</span>
                          </div>
                        </>
                      )}

                      {project.days_remaining > 0 && (
                        <div className="text-xs text-gray-500">
                          残り {project.days_remaining}日
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {project.target_amount > 0 && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getAchievementColor(rate)}`}
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${getAchievementTextColor(rate)}`}>
                          {rate}%
                        </span>
                      </div>
                    )}

                    {/* Expand indicator */}
                    <div className="mt-2 flex justify-center">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-300" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-4 sm:px-5 py-5">
                      <div className="space-y-5">
                        {/* KS Auto Update */}
                        {isKS && (
                          <KickstarterStatsUpdater
                            projectId={project.id}
                            kickstarterUrl={project.link_url}
                            onUpdate={fetchProjects}
                          />
                        )}

                        {/* Detail Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">内部達成額</div>
                            <div className="text-sm font-semibold text-gray-900 mt-1">
                              ¥{project.amount_achieved.toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">外部達成額</div>
                            <div className="text-sm font-semibold text-gray-900 mt-1">
                              ¥{project.external_amount_achieved.toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">内部購入者</div>
                            <div className="text-sm font-semibold text-gray-900 mt-1">
                              {project.buyers_count.toLocaleString()}人
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">外部購入者</div>
                            <div className="text-sm font-semibold text-gray-900 mt-1">
                              {project.external_buyers_count.toLocaleString()}人
                            </div>
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">開始日</span>
                            <div className="font-medium text-gray-700">{project.start_date || '-'}</div>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">終了日</span>
                            <div className="font-medium text-gray-700">{project.end_date || '-'}</div>
                          </div>
                        </div>

                        {/* Video */}
                        {project.video_url && getEmbedUrl(project.video_url) && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">動画</h4>
                            <div className="aspect-video max-w-2xl">
                              <iframe
                                src={getEmbedUrl(project.video_url)!}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full rounded-lg"
                              ></iframe>
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        {project.description && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">詳細説明</h4>
                            <div
                              className="prose prose-sm max-w-none text-gray-600"
                              dangerouslySetInnerHTML={{ __html: project.description }}
                            />
                          </div>
                        )}

                        {/* Creator Description */}
                        {project.creator_description && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">製作者の説明</h4>
                            <div
                              className="prose prose-sm max-w-none text-gray-600"
                              dangerouslySetInnerHTML={{ __html: project.creator_description }}
                            />
                          </div>
                        )}

                        {/* Link */}
                        {project.link_url && (
                          <div>
                            <a
                              href={project.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              外部リンクを開く
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

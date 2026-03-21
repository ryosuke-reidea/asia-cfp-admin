import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, LogOut, ChevronDown, ChevronUp, Eye, EyeOff, Package, Search } from 'lucide-react';
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
    // ページの最上部に自動スクロール
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
      // ログアウト成功時は自動的にログインページにリダイレクトされる
    } catch (error) {
      console.error('Logout error:', error);
      // エラーが発生してもログアウト状態になっているので、ログインページに移動
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

  const navigateToEdit = (projectId: string) => {
    navigate(`/projects/${projectId}/edit`);
  };

  const filteredProjects = projects.filter((project) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      (project.subtitle && project.subtitle.toLowerCase().includes(query))
    );
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">プロジェクト一覧</h1>
        <div className="flex flex-wrap gap-4">
          <Link
            to="/projects/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            新規プロジェクト
          </Link>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            ログアウト
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="プロジェクト名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">
              {searchQuery.trim() ? '検索条件に一致するプロジェクトが見つかりませんでした。' : 'プロジェクトがありません。'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden">
              <div className="divide-y divide-gray-200">
                {filteredProjects.map((project) => (
              <div 
                key={project.id}
                className={`${
                  project.is_featured ? 'bg-indigo-50' : project.is_public ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className="px-6 py-4">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => toggleProjectDetails(project.id)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-1"
                    >
                      {expandedProject === project.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-grow">
                      <button
                        onClick={() => navigateToEdit(project.id)}
                        className="w-full text-left group"
                      >
                        <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                          {project.title}
                          <div className="inline-flex gap-2 ml-2">
                            {project.is_featured && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                Featured
                              </span>
                            )}
                            {!project.is_public && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                非公開
                              </span>
                            )}
                          </div>
                        </div>
                        {project.subtitle && (
                          <div className="text-sm text-gray-500 group-hover:text-indigo-500">
                            {project.subtitle}
                          </div>
                        )}
                      </button>

                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                          <div className="text-xs text-gray-500">カテゴリー</div>
                          <div className="text-sm text-gray-900">{getCategoryName(project.category_id)}</div>
                          {project.category_sort_order > 0 && (
                            <dd className="text-xs text-gray-500">順位: {project.category_sort_order}</dd>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">目標金額</div>
                          <div className="text-sm text-gray-900">¥{project.target_amount.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">達成率</div>
                          <div className="text-sm text-gray-900">
                            {project.target_amount > 0 
                              ? Math.round((project.amount_achieved / project.target_amount) * 100)
                              : 0}%
                          </div>
                        </div>
                        <div className="flex justify-end items-center gap-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleVisibility(project);
                            }}
                            className="text-gray-600 hover:text-gray-900"
                            title={project.is_public ? '非公開にする' : '公開する'}
                          >
                            {project.is_public ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                          <Link
                            to={`/projects/${project.id}/rewards`}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="リターン管理"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Package className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/projects/${project.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="編集"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(project.id);
                            }}
                            className="text-red-600 hover:text-red-900"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedProject === project.id && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="space-y-6">
                      {/* Kickstarter リアルタイム更新コンポーネント */}
                      {project.link_url && project.link_url.includes('kickstarter.com') && (
                        <KickstarterStatsUpdater
                          projectId={project.id}
                          kickstarterUrl={project.link_url}
                          onUpdate={fetchProjects}
                          className="mb-6"
                        />
                      )}

                      {/* Kickstarter リアルタイム更新コンポーネント */}
                      {project.link_url && project.link_url.includes('kickstarter.com') && (
                        <KickstarterStatsUpdater
                          projectId={project.id}
                          kickstarterUrl={project.link_url}
                          onUpdate={fetchProjects}
                          className="mb-6"
                        />
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">達成金額</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            ¥{project.amount_achieved.toLocaleString()}
                            <div className="text-xs text-gray-500">
                              内部: ¥{project.amount_achieved.toLocaleString()} + 外部: ¥{project.external_amount_achieved.toLocaleString()}
                            </div>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">購入者数</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {(project.buyers_count + project.external_buyers_count).toLocaleString()}人
                            <div className="text-xs text-gray-500">
                              内部: {project.buyers_count}人 + 外部: {project.external_buyers_count}人
                            </div>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">開始日</dt>
                          <dd className="mt-1 text-sm text-gray-900">{project.start_date}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">終了日</dt>
                          <dd className="mt-1 text-sm text-gray-900">{project.end_date || '-'}</dd>
                        </div>
                      </div>

                      {project.video_url && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">動画</h4>
                          <div className="aspect-w-16 aspect-h-9">
                            <iframe
                              src={getEmbedUrl(project.video_url)}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full rounded-lg"
                            ></iframe>
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">詳細説明</h4>
                        {project.description ? (
                          <div
                            className="prose max-w-none text-sm text-gray-700"
                            dangerouslySetInnerHTML={{ __html: project.description }}
                          />
                        ) : (
                          <p className="text-sm text-gray-500">詳細説明はありません。</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">リンク先URL</h4>
                        <a
                          href={project.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-800 break-all"
                        >
                          {project.link_url}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                  タイトル
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  カテゴリー
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  目標金額
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  達成金額
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  達成率
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  購入者数
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.map((project) => (
                <React.Fragment key={project.id}>
                  <tr className={`${
                    project.is_featured ? 'bg-indigo-50' : project.is_public ? 'bg-white' : 'bg-gray-50'
                  } hover:bg-gray-50 transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleProjectDetails(project.id)}
                          className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-1"
                        >
                          {expandedProject === project.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {project.title}
                            <div className="inline-flex gap-2 ml-2">
                              {project.is_featured && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  Featured
                                </span>
                              )}
                              {!project.is_public && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  非公開
                                </span>
                              )}
                            </div>
                          </div>
                          {project.subtitle && (
                            <div className="text-sm text-gray-500">{project.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getCategoryName(project.category_id)}
                      {project.category_sort_order > 0 && (
                        <div className="text-xs text-gray-400">順位: {project.category_sort_order}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      ¥{project.target_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      ¥{project.amount_achieved.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {project.target_amount > 0 
                        ? Math.round((project.amount_achieved / project.target_amount) * 100)
                        : 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {(project.buyers_count + project.external_buyers_count).toLocaleString()}人
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end items-center space-x-4">
                        <button
                          onClick={() => handleToggleVisibility(project)}
                          className="text-gray-600 hover:text-gray-900"
                          title={project.is_public ? '非公開にする' : '公開する'}
                        >
                          {project.is_public ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                        <Link
                          to={`/projects/${project.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="編集"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="text-red-600 hover:text-red-900"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedProject === project.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-6">
                          {/* Kickstarter リアルタイム更新コンポーネント */}
                          {project.link_url && project.link_url.includes('kickstarter.com') && (
                            <KickstarterStatsUpdater
                              projectId={project.id}
                              kickstarterUrl={project.link_url}
                              onUpdate={fetchProjects}
                              className="mb-6"
                            />
                          )}

                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <dt className="text-sm font-medium text-gray-500">内部達成金額</dt>
                              <dd className="mt-1 text-sm text-gray-900">¥{project.amount_achieved.toLocaleString()}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">外部達成金額</dt>
                              <dd className="mt-1 text-sm text-gray-900">¥{project.external_amount_achieved.toLocaleString()}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">内部購入者数</dt>
                              <dd className="mt-1 text-sm text-gray-900">{project.buyers_count}人</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">外部購入者数</dt>
                              <dd className="mt-1 text-sm text-gray-900">{project.external_buyers_count}人</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">開始日</dt>
                              <dd className="mt-1 text-sm text-gray-900">{project.start_date}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-gray-500">終了日</dt>
                              <dd className="mt-1 text-sm text-gray-900">{project.end_date || '-'}</dd>
                            </div>
                          </div>

                          {project.video_url && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">動画</h4>
                              <div className="aspect-w-16 aspect-h-9 max-w-2xl">
                                <iframe
                                  src={getEmbedUrl(project.video_url)}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full rounded-lg"
                                ></iframe>
                              </div>
                            </div>
                          )}

                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">詳細説明</h4>
                            {project.description ? (
                              <div
                                className="prose max-w-none text-sm text-gray-700"
                                dangerouslySetInnerHTML={{ __html: project.description }}
                              />
                            ) : (
                              <p className="text-sm text-gray-500">詳細説明はありません。</p>
                            )}
                          </div>

                          {project.creator_description && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">製作者の説明</h4>
                              <div
                                className="prose max-w-none text-sm text-gray-700"
                                dangerouslySetInnerHTML={{ __html: project.creator_description }}
                              />
                            </div>
                          )}

                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">リンク先URL</h4>
                            <a
                              href={project.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-600 hover:text-indigo-800 break-all"
                            >
                              {project.link_url}
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
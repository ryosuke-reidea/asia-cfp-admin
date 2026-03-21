import React from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Edit, Package, CreditCard } from 'lucide-react';
import CommentManager from '../components/CommentManager';

export default function CommentManagement() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();

  if (!projectId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">プロジェクトが見つかりません</h1>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            プロジェクト一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            プロジェクト一覧に戻る
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 flex items-center mb-4">
          <Edit className="w-8 h-8 mr-3 text-indigo-600" />
          プロジェクトの編集
        </h1>
        <p className="text-gray-600 mb-6">
          プロジェクトの詳細情報を編集します。
        </p>

        {/* タブナビゲーション */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <Link
              to={`/projects/${projectId}/edit`}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                location.pathname === `/projects/${projectId}/edit`
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Edit className="w-4 h-4 inline mr-2" />
              プロジェクト編集
            </Link>
            <Link
              to={`/projects/${projectId}/rewards`}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                location.pathname === `/projects/${projectId}/rewards`
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              リターン管理
            </Link>
            <Link
              to={`/projects/${projectId}/comments`}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                location.pathname === `/projects/${projectId}/comments`
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline mr-2" />
              コメント管理
            </Link>
            <Link
              to={`/projects/${projectId}/payments`}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                location.pathname === `/projects/${projectId}/payments`
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CreditCard className="w-4 h-4 inline mr-2" />
              決済管理
            </Link>
          </nav>
        </div>
      </div>

      <CommentManager projectId={projectId} />
    </div>
  );
}
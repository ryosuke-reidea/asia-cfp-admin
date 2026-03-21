import { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Code, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressImage } from '../utils/imageCompression';
import { supabase } from '../lib/supabase';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  linkUrl?: string;
  disabled?: boolean;
  maxImageWidth?: number;
  thumbnailUrl?: string;
}

const minifyHtml = (html: string): string =>
  html.replace(/\n/g, '').replace(/\r/g, '').replace(/\s{2,}/g, ' ').trim();

const RichTextEditor = ({
  content,
  onChange,
  linkUrl,
  disabled = false,
  maxImageWidth,
  thumbnailUrl,
}: RichTextEditorProps) => {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(minifyHtml(content));
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);

  useEffect(() => {
    if (!isHtmlMode && editorRef.current && content !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content;
    }
  }, [content, isHtmlMode]);

  const toggleHtmlMode = () => {
    if (!isHtmlMode) {
      saveSelection();
      const currentHtml = editorRef.current?.innerHTML || '';
      setHtmlContent(minifyHtml(currentHtml));
    } else {
      if (editorRef.current) {
        editorRef.current.innerHTML = htmlContent;
        restoreSelection();
        onChange(minifyHtml(htmlContent));
      }
    }
    setIsHtmlMode(!isHtmlMode);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      selectionRef.current = sel.getRangeAt(0);
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && selectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(selectionRef.current);
    }
  };

  const insertHtml = (html: string) => {
    restoreSelection();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const tempEl = document.createElement('div');
    tempEl.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    while ((node = tempEl.firstChild)) {
      frag.appendChild(node);
    }
    range.insertNode(frag);

    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    const newHtml = editorRef.current?.innerHTML || '';
    const minified = minifyHtml(newHtml);
    setHtmlContent(minified);
    onChange(minified);
  };

  const insertImage = (url: string) => {
    insertHtml(`<img src="${url}" style=" px; width: 100%; height: auto;" />`);
  };

  const handleImageUpload = async (file: File) => {
    try {
      if (!file.type.startsWith('image/')) throw new Error('画像ファイルのみアップロード可能です。');
      const compressedFile = await compressImage(file, {
        maxSizeKB: 200,
        maxWidth: maxImageWidth || 1024,
        maxHeight: 500,
        quality: 0.8,
        format: file.type.includes('gif') ? 'gif' : 'jpeg',
      });
      const fileExtension = file.type.includes('gif') ? 'gif' : (file.name.split('.').pop() || 'jpg');
      const fileName = `${Math.random()}.${fileExtension}`;
      const { error } = await supabase.storage.from('project-images').upload(fileName, compressedFile);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('project-images').getPublicUrl(fileName);
      insertImage(publicUrl);
      toast.success(file.type.includes('gif') ? 'GIF画像を挿入しました。' : '画像を挿入しました。');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'アップロードに失敗しました');
    }
  };

  return (
    <div className={`border rounded-md ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="border-b p-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleHtmlMode}
          className={`p-2 rounded hover:bg-gray-100 ${isHtmlMode ? 'bg-blue-200' : ''}`}
          title="HTMLモード切替"
        >
          {isHtmlMode ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
        </button>
        <label className="p-2 rounded hover:bg-gray-100 cursor-pointer">
          <ImageIcon className="w-4 h-4" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
        </label>
        {thumbnailUrl && (
          <button
            type="button"
            onClick={() => insertImage(thumbnailUrl)}
            className="p-2 rounded hover:bg-gray-100"
            title="サムネイル画像を挿入"
          >
            <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center">
              <span className="text-xs font-bold text-gray-600">T</span>
            </div>
          </button>
        )}
      </div>
      {isHtmlMode ? (
        <textarea
          value={htmlContent}
          onChange={(e) => {
            const minified = minifyHtml(e.target.value);
            setHtmlContent(minified);
            onChange(minified);
          }}
          className="w-full min-h-[200px] p-4 font-mono text-sm border-0 focus:outline-none resize-y"
          placeholder="HTMLを直接編集してください..."
          disabled={disabled}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={(e) => {
            const rawHtml = e.currentTarget.innerHTML;
            const minified = minifyHtml(rawHtml);
            setHtmlContent(minified);
            onChange(minified);
            saveSelection();
          }}
          className="w-full p-4 text-sm min-h-[200px] focus:outline-none max-w-full"
          style={{ whiteSpace: 'pre-wrap' }}
        />
      )}
    </div>
  );
};

export default RichTextEditor;

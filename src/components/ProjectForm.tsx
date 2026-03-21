import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Eye,
  Save,
  ArrowLeft,
  Mail,
  ChevronDown,
  Trash2,
  Send,
  Package,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Project, Category } from "../types/project";
import RichTextEditor from "./RichTextEditor";
import { Upload, Download, RefreshCw, Edit, MessageCircle, CreditCard } from 'lucide-react';
import RewardManager from './RewardManager';
import PaymentManager from './PaymentManager';
import { registerMailMagazines, MailMagazineData } from "../lib/registerMailMagazine";
import { getMailMagazines } from "../lib/getMailMagazine";
import { deleteMailMagazine } from "../lib/deleteMailMagazine";
import { sendMail } from "../lib/sendMail";
import { compressImage, formatFileSize } from "../utils/imageCompression";
import { scrapeKickstarter, KickstarterData } from "../lib/scrapeKickstarter";
import CommentManager from './CommentManager';

// ランダムIDを生成する関数
const generateRandomId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

interface NewsletterForm {
  id: string | null; // ローカルID
  mailMagazineId: string | null; // メールマガジンID
  isLocal: boolean;
  title: string;
  isOpen: boolean;
  scheduledAt?: string; // オプショナルに変更
  subject: string;
  content: string;
}

// 日時文字列のフォーマット用ヘルパー関数
const formatDateTimeForInput = (date: Date): string => {
  return date.toISOString().slice(0, 16);
};

// 動画URLのバリデーション用ヘルパー関数
const isValidVideoUrl = (url: string): boolean => {
  if (!url) return true;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  const vimeoRegex = /^(https?:\/\/)?(www\.)?(vimeo\.com)\/.+/;
  return youtubeRegex.test(url) || vimeoRegex.test(url);
};

// メールマガジンの編集可否を判定するヘルパー関数
const isNewsletterEditable = (scheduledAt?: string): boolean => {
  if (!scheduledAt) return true;
  const now = new Date();
  const deliveryDateTime = new Date(scheduledAt);
  // 配信時刻が現在時刻から10分以内の場合は編集不可
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000 + 9 * 60 * 60 * 1000);
  return deliveryDateTime > tenMinutesFromNow;
};

// メールマガジンの本文サイズをチェックするヘルパー関数
const checkContentSize = (content: string): boolean => {
  // 文字列をバイトに変換してサイズを計算
  const sizeInBytes = new Blob([content]).size;
  const sizeInKB = sizeInBytes / 1024;

  if (sizeInKB > 200) {
    toast.error(
      `メールのサイズが大きすぎます。現在のサイズ: ${Math.round(
        sizeInKB
      )}KB (上限: 200KB)`
    );
    return false;
  }
  return true;
};

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newsletters, setNewsletters] = useState<NewsletterForm[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<Partial<Project>>({
    title: "",
    subtitle: "",
    amount_achieved: 0,
    external_amount_achieved: 0,
    achievement_rate: 0,
    external_achievement_rate: 0,
    buyers_count: 0,
    external_buyers_count: 0,
    description: "",
    link_url: "",
    image_url: "",
    video_url: "",
    target_amount: 0,
    category_id: null,
    creator_description: "",
    start_date: "",  // 空文字に変更
    end_date: "",    // 空文字に変更
    is_featured: false,
    is_public: true,
    project_type: 'media' as const,
    category_sort_order: 0,
  });
  const [showRewardsPreview, setShowRewardsPreview] = useState(false);
  const [newsletterToDelete, setNewsletterToDelete] = useState<string | null>(
    null
  );
  const [showTestMailModal, setShowTestMailModal] = useState(false);
  const [testMailAddress, setTestMailAddress] = useState("");
  const [selectedNewsletterForTest, setSelectedNewsletterForTest] =
    useState<NewsletterForm | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [kickstarterUrl, setKickstarterUrl] = useState("");
  const [isScrapingKickstarter, setIsScrapingKickstarter] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'comments' | 'rewards' | 'payments'>('basic');

  useEffect(() => {
    fetchCategories();
    if (id) {
      fetchProject();
      fetchNewsletters();
    } else {
      // 新規作成時は空のニュースレターを追加しない
      setNewsletters([]);
    }
  }, [id]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      toast.error("カテゴリーの取得に失敗しました。");
      return;
    }

    setCategories(data);
  };

  const fetchNewsletters = async () => {
    if (!id) return;

    const { data: mailMagazineIds, error } = await supabase
      .from("mail_magazines")
      .select("mail_magazine_id")
      .eq("project_id", id);

    if (error) {
      toast.error("メールマガジンの取得に失敗しました。");
      return;
    }

    // getMailMagazinesを使用してメールマガジンの詳細情報を取得
    if (mailMagazineIds && mailMagazineIds.length > 0) {
      const mailMagazineResult = await getMailMagazines({
        ids: mailMagazineIds.map((item: { mail_magazine_id: string }) => item.mail_magazine_id)
      });
      const newsletterForms = mailMagazineResult.data
        .map((mailMagazine: any) => {
          // 新しいAPIレスポンス形式に対応
          const scheduledAtRaw = mailMagazine.sendAt || mailMagazine.scheduledAt;
          const mailMagazineId = mailMagazine.id || mailMagazine.mailMagazineId;
          const content =
            mailMagazine.html || mailMagazine.text || mailMagazine.content || "";
      
          // UTC → JST に変換 (+9時間)
          let scheduledAt = null;
          if (scheduledAtRaw) {
            const utcDate = new Date(scheduledAtRaw);
            const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
            scheduledAt = jstDate.toISOString(); // ISO文字列にしておく
          }
      
          return {
            description: formData.description || null,
            creator_description: formData.creator_description || null,
            id: generateRandomId(),
            mailMagazineId: mailMagazineId,
            isLocal: false,
            title: mailMagazine.managementName,
            isOpen: false,
            isSent: mailMagazine.isSent || false,
            isSending: mailMagazine.isSending || false,
            scheduledAt: scheduledAt,
            subject: mailMagazine.subject,
            content: content,
            htmlContent: content,
          };
        })
        .sort(
          (a: { scheduledAt: string }, b: { scheduledAt: string }) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
      setNewsletters(newsletterForms);
    }
  };

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("プロジェクトの取得に失敗しました。");
      return;
    }

    const formattedData = {
      ...data,
      start_date: data.start_date
        ? new Date(data.start_date).toISOString().split("T")[0]
        : null,
      end_date: data.end_date
        ? new Date(data.end_date).toISOString().split("T")[0]
        : null,
      project_type: data.project_type || 'media',
      category_sort_order: data.category_sort_order || 0,
      // 重複する行を削除し、データベースの値を優先
    };

    setFormData(formattedData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageCompressing(true);

      if (!file.type.startsWith("image/")) {
        throw new Error("画像ファイルのみアップロード可能です。");
      }

      const originalSizeKB = file.size / 1024;
      toast.success(`元画像サイズ: ${formatFileSize(file.size)}`);

      // 画像を自動圧縮（500KB以下に調整）
      const compressedFile = await compressImage(file, {
        maxSizeKB: 500,
        maxWidth: 1900,
        maxHeight: 1200,
        quality: 0.8,
        format: 'jpeg'
      });

      const compressedSizeKB = compressedFile.size / 1024;
      const compressionRatio = ((originalSizeKB - compressedSizeKB) / originalSizeKB * 100).toFixed(1);
      
      if (compressedSizeKB < originalSizeKB) {
        toast.success(
          `画像を圧縮しました: ${formatFileSize(compressedFile.size)} (${compressionRatio}% 削減)`
        );
      } else {
        toast.success(`圧縮後サイズ: ${formatFileSize(compressedFile.size)}`);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from("project-images")
        .upload(filePath, compressedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-images").getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success("画像のアップロードが完了しました。");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "画像のアップロードに失敗しました。"
      );
    } finally {
      setImageCompressing(false);
    }
  };

  const handleKickstarterScrape = async () => {
    if (!kickstarterUrl) {
      toast.error("KickstarterのURLを入力してください。");
      return;
    }

    if (!kickstarterUrl.includes("kickstarter.com")) {
      toast.error("有効なKickstarterのURLを入力してください。");
      return;
    }

    try {
      setIsScrapingKickstarter(true);
      toast.loading("Kickstarterからデータを取得中...", { id: "scraping" });

      const result = await scrapeKickstarter(kickstarterUrl);

      if (!result.success || !result.data) {
        throw new Error(result.error || "データの取得に失敗しました");
      }

      const data = result.data;

      // カテゴリーマッピング（Kickstarterのカテゴリーを既存のカテゴリーにマッピング）
      const categoryMapping: { [key: string]: string } = {
        "technology": "テクノロジー",
        "games": "ゲーム",
        "design": "デザイン",
        "art": "アート",
        "music": "音楽",
        "film": "映画",
        "food": "フード",
        "fashion": "ファッション",
        "publishing": "出版",
        "crafts": "クラフト",
      };

      // 既存のカテゴリーから一致するものを探す
      const matchedCategory = categories.find(cat => 
        cat.name.toLowerCase().includes(data.category.toLowerCase()) ||
        categoryMapping[data.category.toLowerCase()] === cat.name
      );

      // フォームデータを更新
      setFormData({
        ...formData,
        title: data.title,
        subtitle: data.subtitle,
        image_url: data.imageUrl,
        target_amount: data.targetAmount,
        external_amount_achieved: data.currentAmount,
        buyers_count: data.backersCount,
        external_buyers_count: data.backersCount,
        category_id: matchedCategory?.id || null,
        description: data.description,
        creator_description: data.creatorDescription || null,
        video_url: data.videoUrl || "",
        link_url: kickstarterUrl,
      });

      toast.success("Kickstarterからデータを取得しました！", { id: "scraping" });
      setKickstarterUrl(""); // URLをクリア
    } catch (error) {
      console.error("Kickstarter scraping error:", error);
      toast.error(
        error instanceof Error ? error.message : "データの取得に失敗しました",
        { id: "scraping" }
      );
    } finally {
      setIsScrapingKickstarter(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      // バリデーション: 必須項目のチェック
      const invalidRequiredFields = newsletters.some(
        (newsletter) =>
          newsletter.scheduledAt &&
          (!newsletter.subject || !newsletter.content)
      );

      if (invalidRequiredFields) {
        toast.error("配信日時を指定した場合は、件名と本文も必須です。");
        return;
      }

const updateData = {
  title: formData.title,
  subtitle: formData.subtitle,
  external_amount_achieved: formData.external_amount_achieved,
  achievement_rate: formData.achievement_rate,
  external_achievement_rate: formData.external_achievement_rate,
  external_buyers_count: formData.external_buyers_count,
  description: formData.description || null,
  creator_description: formData.creator_description || null,
  link_url: formData.link_url,
  image_url: formData.image_url,
  video_url: formData.video_url,
  start_date: formData.start_date ? formData.start_date : null,
  end_date: formData.end_date ? formData.end_date : null,
  target_amount: formData.target_amount,
  category_id: formData.category_id,
  is_featured: formData.is_featured,
  is_public: formData.is_public,
  project_type: formData.project_type,
  category_sort_order: formData.category_sort_order,
};
      let projectId = id;

      // handleSubmit関数内の修正部分
        if (id) {
          // 修正: .from("projects") を追加
          const { error } = await supabase
            .from("projects")
            .update(updateData)
            .eq("id", id);
        
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("projects")
            .insert([updateData])
            .select()
            .single();
        
          if (error) throw error;
          projectId = data.id;
          // category_sort_orderは自動的に設定されるため、明示的に設定しない
        }

      // さくらへメールマガジンの保存
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        toast.error("ログインが必要です");
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from("subscribers")
        .select("email");

      if (usersError) {
        console.error("Error fetching subscribers:", usersError);
        toast.error("購読者情報の取得に失敗しました");
        return;
      }

      // メルマガ登録用のnewsletterを取得
      const validNewsletters = newsletters.filter((newsletter) => {
        if (
          !newsletter.scheduledAt ||
          !newsletter.subject ||
          !newsletter.content
        ) {
          return false;
        }
        // 配信時刻が10分後以降72時間以下のものだけを対象とする
        const now = new Date();
        const deliveryDateTime = new Date(newsletter.scheduledAt!);
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000 + 9 * 60 * 60 * 1000);
        const seventyTwoHoursFromNow = new Date(now.getTime() + 72 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
        return deliveryDateTime >= tenMinutesFromNow && deliveryDateTime <= seventyTwoHoursFromNow;
      });

      if (validNewsletters.length > 0 && users && users.length > 0) {
        const mailMagazineData: MailMagazineData[] = validNewsletters.map(
          (newsletter) => {

            return {
              managementName: newsletter.title,
              mailMagazineId: newsletter.isLocal
                ? null
                : newsletter.mailMagazineId || null,
              subject: newsletter.subject,
              content: newsletter.content,
              htmlContent: newsletter.content,
              scheduledAt: newsletter.scheduledAt!, // UTCで保存
              // mails: users.map((user) => user.email),
              mails: ["test@example.com"],
              projectType: "PICKS"
            };
          }
        );

        const mailRegistrationSuccess = await registerMailMagazines(
          mailMagazineData
        );
        console.log("メールマガジン登録レスポンス:", mailRegistrationSuccess.data);
        if (!mailRegistrationSuccess.data.success) {
          toast.error("メールマガジンの登録に失敗しました。");
        }

        // supabaseへメールマガジンの保存
        const newsletterPromises = mailRegistrationSuccess.data.data.map((mailMagazine: any) => {
          const newsletterData = {
            project_id: projectId,
            mail_magazine_id: mailMagazine.id,
          };
  
          return supabase
            .from("mail_magazines")
            .upsert(newsletterData, {
              onConflict: 'mail_magazine_id,project_id',
              ignoreDuplicates: false,
            });
        });
  
        const newsletterResults = await Promise.all(newsletterPromises);
        const newsletterErrors = newsletterResults.filter(
          (result: { error: any }) => result.error
        );
  
        if (newsletterErrors.length > 0) {
          console.error("Newsletter errors:", newsletterErrors);
          toast.error("一部のメールマガジンの保存に失敗しました。");
        } else {
          toast.success("プロジェクトとメールマガジンを保存しました。");
        }
      }

      navigate("/");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("保存に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const addNewsletter = () => {
    // 新規追加時もデフォルト時刻は1時間後（JST基準）
    const defaultDate = new Date();
    // UTCからJSTに変換（+9時間）
    defaultDate.setHours(defaultDate.getHours() + 9);
    // さらに1時間後を設定
    defaultDate.setHours(defaultDate.getHours() + 1);
    setNewsletters([
      ...newsletters,
      {
        id: generateRandomId(),
        mailMagazineId: null,
        isLocal: true,
        title: `メールマガジン管理名`,
        isOpen: false,
        scheduledAt: defaultDate.toISOString(),
        subject: "",
        content: "",
      },
    ]);
  };

  const toggleNewsletter = (id: string) => {
    setNewsletters(
      newsletters.map((newsletter) =>
        newsletter.id === id
          ? { ...newsletter, isOpen: !newsletter.isOpen }
          : newsletter
      )
    );
  };

  const updateNewsletterForm = (
    id: string,
    field: keyof NewsletterForm,
    value: string
  ) => {
    const newsletter = newsletters.find((n) => n.id === id);
    if (newsletter && !isNewsletterEditable(newsletter.scheduledAt)) {
      toast.error("配信時刻が近すぎるため編集できません。");
      return;
    }

    // 配信時刻の更新時は10分後以降72時間以下のバリデーションを追加
    if (field === "scheduledAt" && value) {
      // 現在時刻を日本時間に調整（UTC+9）
      const now = new Date();
      const japanTime = new Date(now.getTime());
      const deliveryDateTime = new Date(value);

      // 配信時刻を表示時間（日本時間）へ変換
      const adjustedDeliveryDateTime = new Date(deliveryDateTime.getTime() - 9*60*60*1000);
      const tenMinutesFromNow = new Date(japanTime.getTime() + 10 * 60000);
      const seventyTwoHoursFromNow = new Date(japanTime.getTime() + 72 * 60 * 60 * 1000);

      if (adjustedDeliveryDateTime < tenMinutesFromNow) {
        toast.error("配信時刻は現在時刻から10分後以降を指定してください。");
        return;
      }

      if (adjustedDeliveryDateTime > seventyTwoHoursFromNow) {
        toast.error("配信時刻は現在時刻から72時間以内を指定してください。");
        return;
      }
    }

    setNewsletters(
      newsletters.map((newsletter) =>
        newsletter.id === id ? { ...newsletter, [field]: value } : newsletter
      )
    );
  };

  const deleteNewsletter = async (newsId: string) => {
    console.log(newsId, newsletters);
    const newsletter = newsletters.find((n) => n.id === newsId);
    if (newsletter && !isNewsletterEditable(newsletter.scheduledAt)) {
      toast.error("配信日時を過ぎたメールマガジンは削除できません。");
      return;
    }

    try {
      // 新規作成されたメールマガジン（isLocalがtrue）の場合は、APIを叩かずにローカルで削除
      if (newsletter?.isLocal) {
        setNewsletters(newsletters.filter((n) => n.id !== newsId));
        toast.success("メールマガジンを削除しました。");
        setNewsletterToDelete(null);
        return;
      }

      console.log("newsletter", newsletter);

      if (!newsletter?.mailMagazineId) {
        toast.error("メールマガジンが存在しません。");
        return;
      }

      // 既存のメールマガジンの場合は、APIで削除
      const result = await deleteMailMagazine(newsletter?.mailMagazineId);
      if (!result.success) {
        toast.error("メールマガジンの削除に失敗しました。");
        return;
      }

      // メールマガジンの削除が成功したら、Supabaseのデータも削除
      const { error: deleteError } = await supabase
        .from("mail_magazines")
        .delete()
        .eq("mail_magazine_id", newsletter.mailMagazineId)
        .eq("project_id", id);

      if (deleteError) {
        console.error("Error deleting newsletter from Supabase:", deleteError);
        toast.error("データベースからの削除に失敗しました。");
        return;
      }

      // ローカルのステートから削除
      setNewsletters(newsletters.filter((n) => n.id !== newsId));
      toast.success("メールマガジンを削除しました。");
      setNewsletterToDelete(null);
    } catch (error) {
      console.error("Error deleting newsletter:", error);
      toast.error("メールマガジンの削除に失敗しました。");
    }
  };

  const handleTestMail = async (newsletter: NewsletterForm) => {
    if (!newsletter.subject || !newsletter.content) {
      toast.error("件名と本文を入力してください。");
      return;
    }

    // コンテンツサイズのチェック
    if (!checkContentSize(newsletter.content)) {
      return;
    }

    setSelectedNewsletterForTest(newsletter);
    setShowTestMailModal(true);
  };

  const sendTestMail = async () => {
    if (!selectedNewsletterForTest) return;
    if (!testMailAddress) {
      toast.error("メールアドレスを入力してください。");
      return;
    }

    // コンテンツサイズの再チェック
    if (!checkContentSize(selectedNewsletterForTest.content)) {
      return;
    }

    try {
      const mailData = {
        to: testMailAddress,
        subject: selectedNewsletterForTest.subject,
        content: selectedNewsletterForTest.content,
        htmlContent: selectedNewsletterForTest.content,
      };

      const success = await sendMail(mailData);
      if (success) {
        toast.success("テストメールを送信しました。");
        setShowTestMailModal(false);
        setTestMailAddress("");
        setSelectedNewsletterForTest(null);
      } else {
        toast.error("テストメールの送信に失敗しました。");
      }
    } catch (error) {
      console.error("Error sending test mail:", error);
      toast.error("テストメールの送信に失敗しました。");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            プロジェクト一覧に戻る
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {id ? "プロジェクト編集" : "新規プロジェクト作成"}
        </h1>
        <p className="text-gray-600 mb-6">
          プロジェクトの詳細情報を編集します。
        </p>

        {/* タブナビゲーション */}
        <div className="mb-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('basic')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'basic'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              基本情報
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'comments'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              コメント管理
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rewards'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              リターン管理
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CreditCard className="w-4 h-4 inline mr-2" />
              決済管理
            </button>
          </nav>
        </div>

        {activeTab === 'basic' && <div className="bg-white shadow rounded-lg">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {!id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-blue-900 mb-4">
                    Kickstarterから自動入力
                  </h3>
                  <div className="flex gap-4">
                    <input
                      type="url"
                      value={kickstarterUrl}
                      onChange={(e) => setKickstarterUrl(e.target.value)}
                      placeholder="https://www.kickstarter.com/projects/..."
                      className="flex-1 p-3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      disabled={isScrapingKickstarter}
                    />
                    <button
                      type="button"
                      onClick={handleKickstarterScrape}
                      disabled={isScrapingKickstarter || !kickstarterUrl}
                      className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isScrapingKickstarter ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          取得中...
                        </>
                      ) : (
                        "データを取得"
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-blue-600">
                    KickstarterのプロジェクトURLを入力すると、タイトル、画像、金額などの情報を自動で取得できます。
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  画像 *
                </label>
                <div className="mt-1 flex items-center">
                  {formData.image_url && (
                    <img
                      src={formData.image_url}
                      alt="プレビュー"
                      className="h-32 w-32 object-cover rounded-lg mr-4"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    required={!formData.image_url}
                    disabled={loading || imageCompressing}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  画像ファイル（JPG、PNG、GIF）をアップロードしてください。自動で500KB以下に圧縮されます。
                  {imageCompressing && (
                    <span className="text-indigo-600 font-medium"> 圧縮中...</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  動画URL（任意）
                </label>
                <input
                  type="url"
                  value={formData.video_url || ""}
                  onChange={(e) => {
                    const url = e.target.value;
                    if (!url || isValidVideoUrl(url)) {
                      setFormData({ ...formData, video_url: url });
                    }
                  }}
                  className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="https://youtube.com/watch?v=... または https://vimeo.com/..."
                />
                <p className="mt-2 text-sm text-gray-500">
                  YouTubeまたはVimeoの動画URLを入力してください。
                </p>
              </div>

              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Featured Project
                  </label>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="is_featured"
                        checked={formData.is_featured === true}
                        onChange={() =>
                          setFormData({ ...formData, is_featured: true })
                        }
                        className="form-radio h-4 w-4 text-indigo-600"
                      />
                      <span className="ml-2">Yes</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="is_featured"
                        checked={formData.is_featured === false}
                        onChange={() =>
                          setFormData({ ...formData, is_featured: false })
                        }
                        className="form-radio h-4 w-4 text-indigo-600"
                      />
                      <span className="ml-2">No</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    公開設定
                  </label>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="is_public"
                        checked={formData.is_public === true}
                        onChange={() =>
                          setFormData({ ...formData, is_public: true })
                        }
                        className="form-radio h-4 w-4 text-indigo-600"
                      />
                      <span className="ml-2">公開</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="is_public"
                        checked={formData.is_public === false}
                        onChange={() =>
                          setFormData({ ...formData, is_public: false })
                        }
                        className="form-radio h-4 w-4 text-indigo-600"
                      />
                      <span className="ml-2">非公開</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    公開種別 *
                  </label>
                  <div className="flex space-x-6">
                    <div className="flex items-center">
                      <input
                        id="project_type_media"
                        name="project_type"
                        type="radio"
                        value="media"
                        checked={formData.project_type === 'media'}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <label htmlFor="project_type_media" className="ml-3 block text-sm font-medium text-gray-700">
                        メディア型
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="project_type_crowdfunding"
                        name="project_type"
                        type="radio"
                        value="crowdfunding"
                        checked={formData.project_type === 'crowdfunding'}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <label htmlFor="project_type_crowdfunding" className="ml-3 block text-sm font-medium text-gray-700">
                        クラファン型
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  カテゴリー *
                </label>
                <select
                  value={formData.category_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                  className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">カテゴリーを選択</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="category_sort_order" className="block text-sm font-medium text-gray-700">
                  カテゴリー内表示順位
                </label>
                <input
                  type="number"
                  id="category_sort_order"
                  name="category_sort_order"
                  min="0"
                  value={formData.category_sort_order}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500">
                  数字が小さいほど上位に表示されます（0が最上位）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  タイトル *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  サブタイトル
                </label>
                <input
                  type="text"
                  value={formData.subtitle || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, subtitle: e.target.value })
                  }
                  className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  リンク先URL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.link_url}
                  onChange={(e) =>
                    setFormData({ ...formData, link_url: e.target.value })
                  }
                  className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="https://example.com"
                />
              </div>

              <div className="grid grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    目標金額 *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.target_amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        target_amount: parseInt(e.target.value),
                      })
                    }
                    className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    掲載開始日 *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    終了日 *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    className="p-3 mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* 外部サービス統計 */}

              {/* 外部データ（編集可能） */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">外部サービス（Kickstarterなど）</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="external_amount_achieved" className="block text-sm font-medium text-gray-700">
                      外部達成金額
                    </label>
                    <input
                      type="number"
                      id="external_amount_achieved"
                      name="external_amount_achieved"
                      min="0"
                      value={formData.external_amount_achieved}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Kickstarterなどでの達成金額
                    </p>
                  </div>

                  <div>
                    <label htmlFor="external_buyers_count" className="block text-sm font-medium text-gray-700">
                      外部購入者数
                    </label>
                    <input
                      type="number"
                      id="external_buyers_count"
                      name="external_buyers_count"
                      min="0"
                      value={formData.external_buyers_count}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Kickstarterなどでの購入者数
                    </p>
                  </div>
                </div>
              </div>

              {/* 合計値表示 */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">合計値（表示用）</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      総達成金額
                    </label>
                    <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 font-medium">
                      ¥{formData.amount_achieved.toLocaleString()}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      内部 + 外部の合計
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      総購入者数
                    </label>
                    <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 font-medium">
                      {formData.buyers_count.toLocaleString()}人
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      内部 + 外部の合計
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      総達成率
                    </label>
                    <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 font-medium">
                      {formData.target_amount > 0 
                        ? Math.round((formData.amount_achieved / formData.target_amount) * 100)
                        : 0}%
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      (内部 + 外部) ÷ 目標金額
                    </p>
                  </div>
                </div>
              </div>

              {/* メールマガジン登録フォーム */}
              <div className="py-8 border-t border-b">
                <div className="flex items-center">
                  <Mail className="w-5 h-5 mr-2 text-gray-500" />
                  <h2 className="text-xl font-bold text-gray-900">
                    メールマガジン登録
                  </h2>
                </div>

                <div className="pb-8 pt-4">
                  <div className="space-y-6">
                    {newsletters.map((newsletter) => (
                      <div key={newsletter.id} className="border rounded-lg">
                        <div 
                          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
                          onClick={() => newsletter.id && toggleNewsletter(newsletter.id)}
                        >
                          <div className="flex items-center space-x-4">
                            <input
                              type="text"
                              value={newsletter.title}
                              onChange={(e) =>
                                newsletter.id && updateNewsletterForm(
                                  newsletter.id,
                                  "title",
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="タイトルを入力"
                              className={`${
                                newsletter.isOpen
                                  ? "block w-full px-4 py-3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  : "text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 p-0 min-w-[200px]"
                              } ${
                                !isNewsletterEditable(newsletter.scheduledAt)
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={
                                !isNewsletterEditable(newsletter.scheduledAt)
                              }
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTestMail(newsletter);
                              }}
                              className={`p-1 text-gray-400 hover:text-blue-500 transition-colors ${
                                !isNewsletterEditable(newsletter.scheduledAt)
                                  ? "cursor-not-allowed opacity-50"
                                  : ""
                              }`}
                              title={
                                !isNewsletterEditable(newsletter.scheduledAt)
                                  ? "配信日時を過ぎたメールマガジンはテスト送信できません"
                                  : "テスト送信"
                              }
                              disabled={
                                !isNewsletterEditable(newsletter.scheduledAt)
                              }
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isNewsletterEditable(newsletter.scheduledAt)) {
                                  setNewsletterToDelete(newsletter.id);
                                }
                              }}
                              className={`p-1 text-gray-400 hover:text-red-500 transition-colors ${
                                !isNewsletterEditable(newsletter.scheduledAt)
                                  ? "cursor-not-allowed opacity-50"
                                  : ""
                              }`}
                              title={
                                !isNewsletterEditable(newsletter.scheduledAt)
                                  ? "配信日時を過ぎたメールマガジンは削除できません"
                                  : "削除"
                              }
                              disabled={
                                !isNewsletterEditable(newsletter.scheduledAt)
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronDown
                              className={`w-5 h-5 text-gray-500 transform transition-transform ${
                                newsletter.isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>
                        {newsletter.isOpen && (
                          <div className="px-4 pb-4 space-y-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                配信日時
                              </label>
                              <input
                                type="datetime-local"
                                value={newsletter.scheduledAt ? newsletter.scheduledAt.slice(0, 16) : ''}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  if (inputValue) {
                                    // 入力された時刻をISO文字列に変換
                                    const inputDateTime = new Date(inputValue);
                                    const inputDateTimeJST = new Date(inputDateTime.getTime() - 9 * 60 * 60 * 1000);
                                    const now = new Date();
                                    const japanTime = new Date(now.getTime() - 9 * 60 * 60 * 1000);
                                    // japanTimeの10分後を、UTC+0に戻す
                                    const tenMinutesFromNow = new Date(japanTime.getTime() + 10 * 60000);
                                    // japanTimeの72時間後を、UTC+0に戻す
                                    const seventyTwoHoursFromNow = new Date(japanTime.getTime() + 72 * 60 * 60 * 1000);

                                    console.log("inputDateTimeJST", inputDateTimeJST);
                                    console.log("japanTime", japanTime);
                                    console.log("tenMinutesFromNow", tenMinutesFromNow);
                                    console.log("seventyTwoHoursFromNow", seventyTwoHoursFromNow);

                                    // バリデーション
                                    if (inputDateTimeJST < tenMinutesFromNow) {
                                      toast.error("配信時刻は現在時刻から10分後以降を指定してください。");
                                      return;
                                    }

                                    if (inputDateTimeJST > seventyTwoHoursFromNow) {
                                      toast.error("配信時刻は現在時刻から72時間以内を指定してください。");
                                      return;
                                    }

                                    // バリデーション通過後、フォームを更新
                                    newsletter.id && updateNewsletterForm(
                                      newsletter.id,
                                      "scheduledAt",
                                      inputValue + ":00.000Z"
                                    );
                                  }
                                }}
                                min={(() => {
                                  const now = new Date();
                                  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000 + 9 * 60 * 60 * 1000);
                                  return tenMinutesFromNow.toISOString().slice(0, 16);
                                })()}
                                max={(() => {
                                  const now = new Date();
                                  const seventyTwoHoursFromNow = new Date(now.getTime() + 72 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
                                  return seventyTwoHoursFromNow.toISOString().slice(0, 16);
                                })()}
                                className={`block w-full px-4 py-3 rounded-md shadow-sm focus:ring-indigo-500 sm:text-sm ${
                                  !isNewsletterEditable(newsletter.scheduledAt)
                                    ? "opacity-50 cursor-not-allowed border-gray-300"
                                    : (() => {
                                        if (newsletter.scheduledAt) {
                                          const now = new Date();
                                          const deliveryDateTime = new Date(newsletter.scheduledAt);
                                          const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000 + 9 * 60 * 60 * 1000);
                                          const seventyTwoHoursFromNow = new Date(now.getTime() + 72 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
                                          
                                          if (deliveryDateTime < tenMinutesFromNow || deliveryDateTime > seventyTwoHoursFromNow) {
                                            return "border-red-300 focus:border-red-500";
                                          }
                                        }
                                        return "border-gray-300 focus:border-indigo-500";
                                      })()
                                }`}
                                disabled={
                                  !isNewsletterEditable(newsletter.scheduledAt)
                                }
                              />
                              <p className="mt-1 text-sm text-gray-500">
                                配信時刻は現在時刻から10分後以降72時間以内で設定してください。
                              </p>
                              {newsletter.scheduledAt && (() => {
                                const now = new Date();
                                const deliveryDateTime = new Date(newsletter.scheduledAt);
                                const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000 + 9 * 60 * 60 * 1000);
                                const seventyTwoHoursFromNow = new Date(now.getTime() + 72 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
                                
                                if (deliveryDateTime < tenMinutesFromNow || deliveryDateTime > seventyTwoHoursFromNow) {
                                  return (
                                    <p className="mt-1 text-sm text-red-600">
                                      ⚠️ 設定された時刻は制限時間外です。10分後以降72時間以内の時刻を設定してください。
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                件名
                              </label>
                              <input
                                type="text"
                                value={newsletter.subject}
                                onChange={(e) =>
                                  newsletter.id && updateNewsletterForm(
                                    newsletter.id,
                                    "subject",
                                    e.target.value
                                  )
                                }
                                className={`block w-full px-4 py-3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                                  !isNewsletterEditable(newsletter.scheduledAt)
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                                placeholder="メールの件名を入力"
                                disabled={
                                  !isNewsletterEditable(newsletter.scheduledAt)
                                }
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                本文
                              </label>
                              <div className="space-y-4">
                                <RichTextEditor
                                  content={newsletter.content}
                                  maxImageWidth={500}
                                  disabled={
                                    !isNewsletterEditable(newsletter.scheduledAt)
                                  }
                                  thumbnailUrl={formData.image_url || undefined}
                                  onChange={(content) => {
                                    if (
                                      isNewsletterEditable(newsletter.scheduledAt)
                                    ) {
                                      // エディター内の内容をそのまま保存
                                      newsletter.id && updateNewsletterForm(
                                        newsletter.id,
                                        "content",
                                        content
                                      );
                                    }
                                  }}
                                  linkUrl={formData.link_url}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addNewsletter}
                      className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-500 hover:text-indigo-500 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        + メールマガジンを追加
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  詳細説明
                </label>
                <RichTextEditor
                  content={formData.description || ""}
                  thumbnailUrl={formData.image_url || undefined}
                  onChange={(content) =>
                    setFormData({ ...formData, description: content })
                  }
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  画像は直接貼り付けるか、ドラッグ＆ドロップで追加できます。サムネイル画像を挿入するには「T」ボタンをクリックしてください。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  製作者の説明
                </label>
                <RichTextEditor
                  content={formData.creator_description || ""}
                  thumbnailUrl={formData.image_url || undefined}
                  onChange={(content) => {
                    console.log("onChage creator_description")
                    setFormData({ ...formData, creator_description: content })
                  }}
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  製作者に関する説明や背景情報を記入してください。画像の挿入も可能です。
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  disabled={loading}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  プレビュー
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>}

        {/* コメント管理タブ */}
        {activeTab === 'comments' && (
          <CommentManager projectId={id || ''} />
        )}

        {/* リターン管理タブ */}
        {activeTab === 'rewards' && (
          <RewardManager projectId={id || ''} />
        )}

        {activeTab === 'payments' && (
          <PaymentManager projectId={formData?.id || ''} />
        )}

        {showPreview && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-xl font-bold mb-4">プレビュー</h2>
              <div className="space-y-4">
                {formData.image_url && (
                  <img
                    src={formData.image_url}
                    alt={formData.title}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                )}
                {formData.video_url && (
                  <div className="aspect-w-16 aspect-h-9">
                    <iframe
                      src={formData.video_url.replace("watch?v=", "embed/")}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full rounded-lg"
                    ></iframe>
                  </div>
                )}
                <h3 className="text-xl font-bold">{formData.title}</h3>
                {formData.subtitle && (
                  <p className="text-gray-600">{formData.subtitle}</p>
                )}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">目標金額</p>
                    <p className="font-bold">
                      ¥{formData.target_amount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">達成金額</p>
                    <p className="font-bold">
                      ¥{formData.amount_achieved?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">購入者数</p>
                    <p className="font-bold">{formData.buyers_count}人</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">掲載期間</p>
                    <p className="font-bold">
                      {formData.start_date} 〜 {formData.end_date}
                    </p>
                  </div>
                </div>
                {formData.description && (
                  <div>
                    <p className="text-sm text-gray-500">詳細説明</p>
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: formData.description }}
                    />
                  </div>
                )}
                {formData.creator_description && (
                  <div>
                    <p className="text-sm text-gray-500">製作者の説明</p>
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: formData.creator_description }}
                    />
                  </div>
                )}
                {formData.link_url && (
                  <div>
                    <p className="text-sm text-gray-500">リンク先URL</p>

                    <a
                      href={formData.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      {formData.link_url}
                    </a>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* 削除確認モーダル */}
        {newsletterToDelete && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                メールマガジンの削除
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                このメールマガジンを削除してもよろしいですか？この操作は取り消せません。
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setNewsletterToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => deleteNewsletter(newsletterToDelete)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* テストメール送信モーダル */}
        {showTestMailModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                テストメール送信
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    送信先メールアドレス
                  </label>
                  <input
                    type="email"
                    value={testMailAddress}
                    onChange={(e) => setTestMailAddress(e.target.value)}
                    className="block w-full px-4 py-3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="test@example.com"
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowTestMailModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={sendTestMail}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                  >
                    送信
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
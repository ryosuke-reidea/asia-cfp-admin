// メールマガジンをIDで取得する関数
export async function getMailMagazines({
  ids,
  limit,
  offset,
  isSent,
}: {
  ids?: string[];
  limit?: number;
  offset?: number;
  isSent?: boolean;
}): Promise<{ success: boolean; data?: any }> {
  try {
    const idsParam = ids?.join(",");
    const res = await fetch(
      `https://seogpbjpabhmtmechtxr.functions.supabase.co/get-mail-magazine`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: idsParam,
          limit: limit ? String(limit) : undefined,
          offset: offset ? String(offset) : undefined,
          isSent: isSent ? String(isSent) : undefined,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to fetch mail magazines:", data);
      return { success: false, data };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error("Error fetching mail magazines:", error);
    return { success: false };
  }
}

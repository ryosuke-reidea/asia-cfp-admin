// メールマガジンを削除する関数
export async function deleteMailMagazine(mailMagazineId: string): Promise<{ success: boolean; data?: any }> {
  try {
    const res = await fetch(`https://seogpbjpabhmtmechtxr.functions.supabase.co/delete-mail-magazine?mailMagazineId=${mailMagazineId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Failed to delete mail magazine:', errorText);
      return { success: false, data: errorText };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting mail magazine:', error);
    return { success: false };
  }
}
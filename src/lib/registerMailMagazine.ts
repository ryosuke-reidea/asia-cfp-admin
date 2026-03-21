
export type MailMagazineData = {
  managementName: string;
  mailMagazineId: string | null;
  subject: string;
  content: string;
  htmlContent: string | null;
  scheduledAt: string; // JSTのISO文字列
  mails: string[];
};

export async function registerMailMagazines(
  mail_magazines: MailMagazineData[],
): Promise<{ success: boolean; data?: any }> {
  try {

    const payload = {
      mails: mail_magazines.map((mail) => {
        const jstDate = new Date(mail.scheduledAt);
        // JST → UTC（9時間引く）
        const utcDate = new Date(jstDate.getTime() - 9 * 60 * 60 * 1000);

        return {
          id: mail.mailMagazineId,
          managementName: mail.managementName,
          to: mail.mails,
          subject: mail.subject,
          text: mail.content,
          html: mail.htmlContent,
          // SendGrid は UTCのUNIX秒で受け取る
          sendAt: utcDate.toISOString(),
          categories: ["picks-mail-magazine"],
        };
      }),
    };

    const res = await fetch(
      "https://seogpbjpabhmtmechtxr.functions.supabase.co/register-mail-magazine",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = await res.json();
    console.log("data:", data);

    if (!res.ok) {
      console.error("Mail sending failed:", data);
      return { success: false, data };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending mail:", error);
    return { success: false };
  }
}

export type MailData = {
  to: string;
  subject: string;
  content: string;
  htmlContent: string;
}

export async function sendMail(mail: MailData): Promise<boolean> {
  try {

    const payload = {
      to: mail.to,
      subject: mail.subject,
      text: mail.content,
      html: mail.htmlContent,
      categories: ["picks-admin"],
    }

    const res = await fetch('https://seogpbjpabhmtmechtxr.functions.supabase.co/send-mail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('Mail sending failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending mail:', error);
    return false;
  }
}
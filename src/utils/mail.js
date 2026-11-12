import Mailgen from "mailgen";

// Brevo transactional email API (HTTPS on port 443, so it works on hosts that block SMTP ports).
// Required env vars:
//   BREVO_API_KEY    — from Brevo dashboard → SMTP & API → API Keys
//   MAIL_FROM_EMAIL  — a sender address verified in Brevo → Senders
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "Profligate",
    link: process.env.CLIENT_URL || "http://localhost:5173",
  },
});

const emailVerificationMailGenContent = (name, verificationUrl) => {
  return {
    body: {
      name,
      intro: "Welcome to Profligate! We are excited to have you on board!",
      action: {
        instructions:
          "To verify your email, please click on the following button:",
        button: {
          color: "#4140A8",
          text: "Verify Your Email",
          link: verificationUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help :)",
    },
  };
};

const forgotPasswordMailGenContent = (name, passwordResetUrl) => {
  return {
    body: {
      name,
      intro: "We received a request to reset the password for your account.",
      action: {
        instructions:
          "To reset your password, please click on the following button:",
        button: {
          color: "#101049",
          text: "Reset Password",
          link: passwordResetUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help :)",
    },
  };
};

const sendEmail = async (options) => {
  const { to, subject, mailgenContent } = options;
  const html = mailGenerator.generate(mailgenContent);
  const text = mailGenerator.generatePlaintext(mailgenContent);

  if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM_EMAIL) {
    throw new Error(
      "Email not configured: BREVO_API_KEY and MAIL_FROM_EMAIL must be set.",
    );
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Profligate", email: process.env.MAIL_FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  // Unlike Resend's SDK, we fail loudly so callers know the email didn't go out.
  if (!response.ok) {
    console.error("Brevo Error:", response.status, data);
    throw new Error(
      data.message || `Brevo request failed with status ${response.status}`,
    );
  }

  console.log("Email sent via Brevo:", data.messageId);
  return data;
};

const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  return sendEmail({
    to,
    subject: "Verify Your Email - Profligate",
    mailgenContent: emailVerificationMailGenContent(name, verificationUrl),
  });
};

const sendPasswordResetEmail = async ({ to, name, passwordResetUrl }) => {
  return sendEmail({
    to,
    subject: "Password Reset - Profligate",
    mailgenContent: forgotPasswordMailGenContent(name, passwordResetUrl),
  });
};

export {
  emailVerificationMailGenContent,
  forgotPasswordMailGenContent,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendEmail,
};

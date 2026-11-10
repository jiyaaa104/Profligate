import { Resend } from "resend";
import Mailgen from "mailgen";

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

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

  try {
    // Resend uses HTTPS (Port 443) which Render CANNOT block
    const data = await resend.emails.send({
      from: "Profligate <onboarding@resend.dev>",
      to,
      subject,
      html,
      text,
    });
    console.log("Email sent via Resend:", data);
    return data;
  } catch (error) {
    console.error("Resend Error:", error);
    throw error;
  }
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

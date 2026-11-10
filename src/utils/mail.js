import nodemailer from "nodemailer";
import Mailgen from "mailgen";

const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "Profligate",
    link: process.env.CLIENT_URL || "http://localhost:5173",
  },
});

// Create the Gmail Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your gmail address
    pass: process.env.EMAIL_PASS, // The 16-letter App Password
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
  if (!to || !subject || !mailgenContent) {
    throw new Error("Missing required email parameters.");
  }

  const html = mailGenerator.generate(mailgenContent);
  const text = mailGenerator.generatePlaintext(mailgenContent);

  const message = {
    from: `"Profligate" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(message);
    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Nodemailer Error:", error);
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

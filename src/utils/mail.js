import Mailgen from "mailgen";
import sgMail from "@sendgrid/mail";

// Configure Mailgen
const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "Profligate",
    link: process.env.APP_URL || "http://localhost:5173",
  },
});

// Configure SendGrid API Key
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is missing");
}

if (!process.env.SENDGRID_FROM_EMAIL) {
  throw new Error("SENDGRID_FROM_EMAIL is missing");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject,
    text,
    html,
  };

  try {
    const [response] = await sgMail.send(message);
    return response;
  } catch (error) {
    console.error("SendGrid Error:", {
      message: error.message,
      response: error.response?.body,
      statusCode: error.code,
    });

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

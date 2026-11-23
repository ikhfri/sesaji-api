import { sendVerificationEmail } from "../shared/services/email.service.js";

async function main() {
  const recipient = process.env.TEST_EMAIL_TO;

  if (!recipient) {
    throw new Error("TEST_EMAIL_TO is required");
  }

  await sendVerificationEmail(
    recipient,
    "SESAJI Test User",
    "test-verification-token-123456789",
  );

  console.log("Verification email sent successfully!");
}

main().catch((error) => {
  console.error("Email sending failed:", error);
  process.exit(1);
});
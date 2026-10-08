import { prisma } from './src/config/db.js';
async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "Evaluation",
        "Submission",
        "MentorMessage",
        "Ticket",
        "Payment",
        "Subscription",
        "StarterRepo",
        "GitHubConnection",
        "EmailVerificationToken",
        "PasswordResetToken",
        "RefreshToken",
        "User"
      CASCADE
    `);
    console.log("SUCCESS");
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();

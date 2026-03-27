// OpenClaw Skill: Exam Reminder
// Runs as a cron job via OpenClaw — sends Telegram/WhatsApp message
// when an exam is approaching (3 days, 1 day, day of)

// This skill is registered in OpenClaw, not called directly by the backend.
// Configure it in the OpenClaw dashboard after deployment.

export const examReminderSkill = {
  name: 'exam-reminder',
  description: 'Sends study reminders via Telegram when exams are approaching',
  schedule: '0 19 * * *', // runs every day at 7pm
  // TODO: implement skill logic
  // 1. Read all students from OpenClaw memory
  // 2. Check exam dates
  // 3. If exam within 3 days → send Telegram message with today's focus topic
}

import admin from 'firebase-admin';
import { db } from './firebase-config.js';

/**
 * Send push notification to specific users
 * @param {string[]} userIds - Array of user IDs to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 */
export async function sendPushNotification(userIds, title, body, data = {}) {
  try {
    if (!userIds || userIds.length === 0) {
      console.log('No users to send notification to');
      return;
    }

    // Get FCM tokens for all users
    const tokens = [];
    for (const userId of userIds) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (userData?.fcmToken) {
          tokens.push(userData.fcmToken);
        }
      } catch (error) {
        console.error(`Error getting FCM token for user ${userId}:`, error);
      }
    }

    if (tokens.length === 0) {
      console.log('No FCM tokens found for users');
      return;
    }

    // Send notification to all tokens
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`✅ Sent ${response.successCount} notifications successfully`);
    if (response.failureCount > 0) {
      console.log(`❌ Failed to send ${response.failureCount} notifications`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`  Failed for token ${idx}:`, resp.error);
        }
      });
    }

    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

/**
 * Send notification when a new task is created
 * @param {object} task - The task object
 * @param {string[]} assignedTo - Array of user IDs the task is assigned to
 */
export async function sendNewTaskNotification(task, assignedTo) {
  const title = '📋 Công việc mới';
  const body = `Bạn có công việc mới: ${task.title}`;
  const data = {
    type: 'new_task',
    taskId: task.id || '',
    priority: task.priority || 'medium',
  };

  return sendPushNotification(assignedTo, title, body, data);
}

/**
 * Send notification when a task is scored
 * @param {object} task - The task object
 * @param {string} userId - User ID who got scored
 * @param {number} score - The score received
 */
export async function sendTaskScoredNotification(task, userId, score) {
  const title = '⭐ Công việc đã được chấm điểm';
  const body = `Công việc "${task.title}" đã được chấm ${score} điểm`;
  const data = {
    type: 'task_scored',
    taskId: task.id || '',
    score: score.toString(),
  };

  return sendPushNotification([userId], title, body, data);
}

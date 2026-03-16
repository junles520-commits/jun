import { processFeishuMessage } from './feishu.js';

// Mock replyFeishuMessage to just console.log
// We can't easily mock it without changing feishu.ts, but we can just see what it does.
// Actually, let's just run it with a dummy messageId. It will fail to reply but we can see the console.
processFeishuMessage('510300', 'dummy_id').then(() => console.log('Done')).catch(console.error);

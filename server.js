require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Конфигурация (лучше хранить в .env)
const config = {
  PRIVATE_KEY: process.env.PRIVATE_KEY || 'ваш_приватный_ключ',
  PROVIDER_URL: process.env.PROVIDER_URL || 'https://testnet-rpc.monad.xyz',
  TOKEN_CONTRACT_ADDRESS: process.env.TOKEN_CONTRACT || '0x72dA30dB47C0999F2891cD328Fc45cB3FffBFDa3',
  PORT: process.env.PORT || 3000
};

// ABI токена (минимум необходимых функций)
const TOKEN_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

// Инициализация провайдера и контракта
let provider;
let wallet;
let tokenContract;

try {
  provider = new ethers.providers.JsonRpcProvider(config.PROVIDER_URL);
  wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
  tokenContract = new ethers.Contract(
    config.TOKEN_CONTRACT_ADDRESS,
    TOKEN_ABI,
    wallet
  );
  
  console.log('Server initialized with address:', wallet.address);
} catch (error) {
  console.error('Initialization error:', error);
  process.exit(1);
}

// Проверка балансов при старте
async function checkBalances() {
  try {
    const ethBalance = await provider.getBalance(wallet.address);
    const tokenBalance = await tokenContract.balanceOf(wallet.address);
    const decimals = await tokenContract.decimals();
    
    console.log('\n--- Current Balances ---');
    console.log('ETH:', ethers.utils.formatEther(ethBalance));
    console.log('Tokens:', ethers.utils.formatUnits(tokenBalance, decimals));
    console.log('------------------------\n');
  } catch (error) {
    console.error('Balance check error:', error);
  }
}

// Проверка работы сервера
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'active',
    network: 'Monad Testnet',
    tokenContract: config.TOKEN_CONTRACT_ADDRESS,
    serverAddress: wallet.address
  });
});

// Отправка токенов
app.post('/send-tokens', async (req, res) => {
  try {
    // Валидация входных данных
    if (!req.body.address || !req.body.points) {
      return res.status(400).json({
        success: false,
        error: 'Missing address or points'
      });
    }

    // Проверка адреса
    if (!ethers.utils.isAddress(req.body.address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    const points = parseInt(req.body.points);
    if (isNaN(points) || points <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Points must be a positive number'
      });
    }

    console.log(`Sending ${points} tokens to ${req.body.address}`);

    // Получаем decimals токена
    const decimals = await tokenContract.decimals();
    const amount = ethers.utils.parseUnits(points.toString(), decimals);

    // Проверяем баланс
    const balance = await tokenContract.balanceOf(wallet.address);
    if (balance.lt(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient token balance'
      });
    }

    // Отправляем транзакцию
    const tx = await tokenContract.transfer(req.body.address, amount);
    console.log('Transaction sent, hash:', tx.hash);

    // Ждем подтверждения (можно убрать для более быстрого ответа)
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    res.json({ 
      success: true,
      transactionHash: tx.hash,
      explorerLink: `https://testnet-explorer.monad.xyz/tx/${tx.hash}`
    });

  } catch (error) {
    console.error('Error sending tokens:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || 'Unknown error'
    });
  }
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error'
  });
});

// Запуск сервера
app.listen(config.PORT, async () => {
  console.log(`Server running on port ${config.PORT}`);
  await checkBalances();
  
  console.log(`\nToken contract: ${config.TOKEN_CONTRACT_ADDRESS}`);
  console.log(`To test send tokens, run:`);
  console.log(`curl -X POST http://localhost:${config.PORT}/send-tokens \\`);
  console.log(`-H "Content-Type: application/json" \\`);
  console.log(`-d '{"address":"0xRECIPIENT","points":100}'`);
});

// Проверка балансов каждые 5 минут
setInterval(checkBalances, 5 * 60 * 1000);
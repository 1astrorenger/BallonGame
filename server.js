const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Конфигурация
const PRIVATE_KEY = '45df04e0c63882f3f2294c1a9a9a00dc5291dd5fd9e0656d3999d766bc7c747a'; // Никому не показывайте!
const PROVIDER_URL = 'https://testnet-rpc.monad.xyz';
const TOKEN_CONTRACT = '0x72dA30dB47C0999F2891cD328Fc45cB3FffBFDa3';

// Подключаемся к сети
const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const tokenContract = new ethers.Contract(
  TOKEN_CONTRACT,
  [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)"
  ],
  wallet
);

// Маршрут для отправки токенов
app.post('/send-tokens', async (req, res) => {
  try {
    const { address, points } = req.body;
    
    // Отправляем токены (1 токен = 1 очко)
    const tx = await tokenContract.transfer(
      address,
      ethers.utils.parseUnits(points.toString(), 18)
    );
    
    res.json({ 
      success: true,
      transactionHash: tx.hash
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
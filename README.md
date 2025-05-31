# 🤖 Blockchain AI Chatbot

A CLI AI assistant powered by **Gemini 2.0** and **Blockscout** that lets you query Ethereum blockchain data using natural language!

Built for **ETH Prague 2025** hackathon using Blockscout's API and Google's latest Gemini 2.0 with function calling.

## ✨ Features

- 🧠 **Natural Language Interface**: Ask questions in plain English
- 🔧 **Smart Function Calling**: Gemini automatically calls the right blockchain APIs
- 📊 **Comprehensive Data**: Address info, transactions, tokens, blocks, and network stats
- ⚡ **Real-time**: Live data from Ethereum mainnet via Blockscout
- 🚀 **Fast**: Built with Bun for maximum performance

## 🛠️ Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- Google AI Studio API key (get one [here](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd eth-prague-25
   bun install
   ```

2. **Set up your API key:**
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```
   
   Or create a `.env` file:
   ```bash
   echo "GEMINI_API_KEY=your-api-key-here" > .env
   ```

3. **Start the chatbot:**
   ```bash
   bun run chat
   ```

### 🐛 Debug Mode

To enable verbose debug logging for troubleshooting:

```bash
DEBUG=true bun run chat
```

This will show detailed logs of:
- API calls and responses
- Function executions
- AI processing steps
- ENS resolution attempts
- Error details

## 💬 Usage Examples

Once the chatbot starts, you can ask questions like:

### 🏦 Address Queries
- **"What's the balance of vitalik.eth?"** ← Now works with ENS names!
- "Show me info about 0x1234567890123456789012345678901234567890"
- "Get token balances for vitalik.eth"

### 📝 Transaction Queries  
- "Show me recent transactions for vitalik.eth"
- "What happened in transaction 0xabcd...?"
- "Get details for tx 0x1234567890123456789012345678901234567890123456789012345678901234"

### 🪙 Token Information
- "Tell me about USDC token"
- "Search for Chainlink token"
- "What's the info for token contract 0xA0b86a33E6417efF8BC19FdDa0C19Bb82E9d5b6"

### 📦 Block Data
- "Show me the latest blocks"
- "What are the recent 10 blocks?"
- "Get blockchain stats"

### 🔍 General Search & ENS Resolution
- **"Search for vitalik.eth"** ← Resolves ENS names to addresses
- "Find information about ENS"
- "Search for anything blockchain related"

## 🔧 Available Functions

The AI can automatically call these functions based on your queries:

| Function                  | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `getAddressInfo`          | Get address balance, type, and verification status                                          |
| `getAddressTransactions`  | Fetch recent transactions for an address                                                    |
| `getAddressTokenBalances` | Get all token balances for an address                                                       |
| `getTokenInfo`            | Get token details (name, symbol, supply, etc.)                                              |
| `getTransactionInfo`      | Get detailed transaction information                                                        |
| `getLatestBlocks`         | Fetch recent blocks from the blockchain                                                     |
| **`searchBlockchain`**    | **🌟 Universal search: resolves ENS names, finds tokens, addresses, transactions, and more** |
| `getNetworkStats`         | Get overall network statistics                                                              |

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │───▶│  Gemini 2.0 AI  │───▶│  Function Call  │
│ (Natural Lang.) │    │ (Function Call) │    │   (Blockscout)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ AI Response     │◀───│  Gemini 2.0 AI  │◀───│ Blockchain Data │
│ (Formatted)     │    │ (Interpret)     │    │   (JSON)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Ultra-fast JavaScript runtime
- **AI**: [Google Gemini 2.0](https://ai.google.dev/) - Latest AI with function calling
- **Blockchain API**: [Blockscout](https://blockscout.com/) - Ethereum blockchain explorer API
- **Types**: TypeScript with auto-generated OpenAPI types
- **HTTP Client**: openapi-hooks for type-safe API calls

## 🎯 Hackathon Integration

This project integrates **Blockscout** (one of ETH Prague 2025's sponsors) by:

1. **Using Blockscout's comprehensive API** for all blockchain data
2. **Auto-generated TypeScript types** from Blockscout's OpenAPI spec
3. **Real-time data** from Ethereum mainnet via `eth.blockscout.com`
4. **Natural language interface** making blockchain data accessible to everyone

## 🔄 Development

### Regenerate API Types
```bash
bun run api-schema
```

### Add New Functions
1. Add function declaration in `src/cli.ts`
2. Implement the function using `useApi`
3. Add it to the `executeFunction` switch statement

### Environment Variables
- `GEMINI_API_KEY` - Your Google AI Studio API key (required)

## 🤝 Contributing

This is a hackathon project, but feel free to fork and improve!

## 📄 License

MIT License - See LICENSE file for details.

---

**Built with ❤️ for ETH Prague 2025**

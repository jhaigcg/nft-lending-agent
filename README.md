# 🏛️ NFT Lending Evaluator Agent

An AI-powered underwriting engine that evaluates any NFT as collateral and recommends a USDT loan amount with professional risk assessment.

## 🚀 Features

- Fetches real-time NFT metadata from Moralis API
- Analyzes trait rarity and calculates premium
- Gets live ETH prices from CoinGecko
- Calculates dynamic LTV (40-70%) based on risk factors
- Generates professional markdown loan reports

## 📊 Example Results

| Collection | Token ID | Floor Price | Rare Trait | Loan Amount |
|------------|----------|-------------|------------|-------------|
| Pudgy Penguins | 6878 | 8.7 ETH | Monocle (3%) | **$19,630 USDT** |
| BAYC | 7092 | 14.2 ETH | - | **$32,051 USDT** |
| Azuki | 1234 | 4.3 ETH | - | **$8,819 USDT** |

## 🛠️ Tech Stack

- **LangGraph** - Stateful agent orchestration
- **LangChain** - Tool abstraction and LLM integration
- **Moralis API** - Real-time NFT metadata
- **Ollama/llama.cpp** - Local LLM (Llama 3.2 3B)
- **TypeScript** - Entire codebase
- **CoinGecko API** - Live ETH/USDT prices

## 📋 Prerequisites

- Node.js (v18 or higher)
- Moralis API key (free at https://moralis.io)
- Ollama or llama.cpp (for local LLM)

## 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/username/nft-lending-agent.git
cd nft-lending-agent

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Moralis API key to .env

# Start the local LLM (Ollama)
ollama pull llama3.2:3b
ollama run llama3.2:3b

# Run the agent
npm run dev
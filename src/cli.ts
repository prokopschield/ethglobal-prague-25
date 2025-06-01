import { GoogleGenAI, type FunctionDeclaration, Type, FunctionCallingConfigMode, type ContentListUnion, type Content, type FunctionCall, FunctionResponse, Chat, type Part } from '@google/genai';
import { useApi } from './api';
import * as readline from 'readline';

// Debug logging utility
const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
const debug = (message: string, data?: any) => {
    if (DEBUG) {
        console.log(`🐛 DEBUG: ${message}`);
        if (data !== undefined) {
            console.log('🐛 DATA:', JSON.stringify(data, null, 2));
        }
    }
};

// Initialize Google Gen AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ Please set GEMINI_API_KEY environment variable');
    process.exit(1);
}

debug('Initializing Google Gen AI with API key');
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Function declarations for Gemini
const functionDeclarations: FunctionDeclaration[] = [
    {
        name: 'getAddressInfo',
        description: 'Get basic information about an Ethereum address (0x...) including balance, transaction count, and type. Note: If you have an ENS name like vitalik.eth, use searchBlockchain first to resolve it to an address.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                address: {
                    type: Type.STRING,
                    description: 'Ethereum address in 0x format (40 characters after 0x)'
                }
            },
            required: ['address']
        }
    },
    {
        name: 'getAddressTransactions',
        description: 'Get recent transactions for an Ethereum address (0x...). If you have an ENS name, use searchBlockchain first to resolve it.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                address: {
                    type: Type.STRING,
                    description: 'Ethereum address in 0x format (40 characters after 0x)'
                },
                limit: {
                    type: Type.NUMBER,
                    description: 'Number of transactions to retrieve (default: 10, max: 50)'
                }
            },
            required: ['address']
        }
    },
    {
        name: 'getAddressTokenBalances',
        description: 'Get all token balances for an Ethereum address (0x...). Shows ERC-20, ERC-721, and other token holdings. If you have an ENS name, use searchBlockchain first.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                address: {
                    type: Type.STRING,
                    description: 'Ethereum address in 0x format (40 characters after 0x)'
                }
            },
            required: ['address']
        }
    },
    {
        name: 'getTokenInfo',
        description: 'Get detailed information about a specific token by its contract address, including name, symbol, total supply, and holder count.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                tokenAddress: {
                    type: Type.STRING,
                    description: 'Token contract address in 0x format'
                }
            },
            required: ['tokenAddress']
        }
    },
    {
        name: 'getTransactionInfo',
        description: 'Get detailed information about a specific transaction including gas usage, fees, method called, and status.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                txHash: {
                    type: Type.STRING,
                    description: 'Transaction hash in 0x format (64 characters after 0x)'
                }
            },
            required: ['txHash']
        }
    },
    {
        name: 'getLatestBlocks',
        description: 'Get information about the most recent blocks on the Ethereum blockchain, including block numbers, timestamps, gas usage, and miner information.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                count: {
                    type: Type.NUMBER,
                    description: 'Number of latest blocks to retrieve (default: 5, max: 50)'
                }
            }
        }
    },
    {
        name: 'searchBlockchain',
        description: 'Universal search function that can find and resolve: ENS names (like vitalik.eth), addresses, transaction hashes, block numbers, token names/symbols, and more. This is the best function to use when you have ENS names or need to find something by name or partial identifier.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: 'Search query - can be ENS names (vitalik.eth), partial addresses, token names (USDC), transaction hashes, block numbers, or any blockchain identifier'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'getNetworkStats',
        description: 'Get overall Ethereum network statistics including total blocks, transactions, addresses, average block time, and network utilization.',
        parameters: {
            type: Type.OBJECT,
            properties: {}
        }
    }
];

debug('Function declarations loaded', { count: functionDeclarations.length });

// System prompt to guide AI behavior for CLI interaction
const SYSTEM_PROMPT = `You are a helpful blockchain assistant for a CLI (command-line interface) application that helps humans interact with the Ethereum blockchain using the Blockscout API.

**Key Guidelines:**
- You are running in a terminal environment, so NEVER use markdown formatting (no \`\`\`, **, _, etc.)
- Instead of markdown, use ANSI color codes and terminal formatting for better visual output:
  • Use colors like \x1b[32m for green (success), \x1b[31m for red (errors), \x1b[36m for cyan (info), \x1b[33m for yellow (warnings)
  • Use \x1b[1m for bold text, \x1b[0m to reset formatting
  • Use emojis and symbols for visual appeal: ✅ ❌ 🔍 💰 📊 ⚡ 🚀
- Provide clear, concise responses that work well in a terminal
- When showing data, format it nicely with proper spacing and alignment
- Always be helpful and explain what the data means in human terms
- If ENS names are provided (like vitalik.eth), use the searchBlockchain function first to resolve them to addresses
- Format large numbers with proper units (ETH, Gwei, etc.) and make them readable
- For addresses, show both full and shortened versions when appropriate (0x1234...5678)

**About the Project:**
This is a CLI chatbot built for ETHGlobal Prague 2025 hackathon that integrates:
- Google Gemini 2.0 AI with function calling capabilities
- Blockscout API for real-time Ethereum blockchain data
- Natural language processing to make blockchain data accessible

You have access to comprehensive blockchain tools including address lookups, transaction details, token information, block data, network statistics, and universal search functionality. Use these tools to provide accurate, up-to-date information about the Ethereum blockchain.`;

// Tool function implementations
async function getAddressInfo(address: string) {
    debug(`getAddressInfo called with address: ${address}`);
    try {
        debug('Making API call to /addresses/{address_hash}');
        const response = await useApi('/addresses/{address_hash}', 'get', {
            path: { address_hash: address }
        });
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error fetching address info: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', data);
        
        const result = {
            address: data.hash,
            balance: data.coin_balance || '0',
            type: data.is_contract ? 'Contract' : 'EOA (Externally Owned Account)',
            verified: data.is_verified || false
        };
        
        debug('Processed result', result);
        return result;
    } catch (error) {
        debug('Error in getAddressInfo', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getAddressTransactions(address: string, limit: number = 10) {
    debug(`getAddressTransactions called with address: ${address}, limit: ${limit}`);
    try {
        debug('Making API call to /addresses/{address_hash}/transactions');
        const response = await useApi('/addresses/{address_hash}/transactions', 'get', {
            path: { address_hash: address }
        });
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error fetching transactions: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', { itemsCount: data.items?.length });
        
        const transactions = data.items?.slice(0, limit) || [];
        debug(`Processing ${transactions.length} transactions`);
        
        const result = transactions.map((tx: any) => ({
            hash: tx.hash,
            from: tx.from?.hash,
            to: tx.to?.hash,
            value: tx.value,
            gasUsed: tx.gas_used,
            status: tx.status,
            timestamp: tx.timestamp,
            method: tx.method
        }));
        
        debug('Processed transactions result', { count: result.length });
        return result;
    } catch (error) {
        debug('Error in getAddressTransactions', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getAddressTokenBalances(address: string) {
    debug(`getAddressTokenBalances called with address: ${address}`);
    try {
        debug('Making API call to /addresses/{address_hash}/token-balances');
        const response = await useApi('/addresses/{address_hash}/token-balances', 'get', {
            path: { address_hash: address }
        });
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error fetching token balances: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', { balancesCount: data.length });
        
        const result = data.map((balance: any) => ({
            token: {
                name: balance.token.name,
                symbol: balance.token.symbol,
                address: balance.token.address
            },
            value: balance.value,
            valueFloat: balance.value_float
        }));
        
        debug('Processed token balances result', { count: result.length });
        return result;
    } catch (error) {
        debug('Error in getAddressTokenBalances', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getTokenInfo(tokenAddress: string) {
    debug(`getTokenInfo called with tokenAddress: ${tokenAddress}`);
    try {
        debug('Making API call to /tokens/{address_hash}');
        const response = await useApi('/tokens/{address_hash}', 'get', {
            path: { address_hash: tokenAddress }
        });
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error fetching token info: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', data);
        
        const result = {
            name: data.name,
            symbol: data.symbol,
            decimals: data.decimals,
            totalSupply: data.total_supply,
            holderCount: data.holders,
            transferCount: 'N/A',
            type: data.type
        };
        
        debug('Processed token info result', result);
        return result;
    } catch (error) {
        debug('Error in getTokenInfo', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getTransactionInfo(txHash: string) {
    debug(`getTransactionInfo called with txHash: ${txHash}`);
    try {
        debug('Making API call to /transactions/{transaction_hash}');
        const response = await useApi('/transactions/{transaction_hash}', 'get', {
            path: { transaction_hash: txHash }
        });
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error fetching transaction: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', data);
        
        const result = {
            hash: data.hash,
            from: data.from?.hash,
            to: data.to?.hash,
            value: data.value,
            gasUsed: data.gas_used,
            gasLimit: data.gas_limit,
            gasPrice: data.gas_price,
            status: data.status,
            blockNumber: data.block_number,
            timestamp: data.timestamp,
            method: data.method,
            fee: data.fee
        };
        
        debug('Processed transaction info result', result);
        return result;
    } catch (error) {
        debug('Error in getTransactionInfo', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getLatestBlocks(count: number = 5) {
    debug(`getLatestBlocks called with count: ${count}`);
    try {
        debug('Making API call to /blocks');
        const response = await useApi('/blocks', 'get', {});
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error fetching blocks: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', { itemsCount: data.items?.length });
        
        const blocks = data.items?.slice(0, count) || [];
        debug(`Processing ${blocks.length} blocks`);
        
        const result = blocks.map((block: any) => ({
            number: block.height,
            hash: block.hash,
            timestamp: block.timestamp,
            transactionCount: block.transaction_count,
            miner: block.miner?.hash,
            gasUsed: block.gas_used,
            gasLimit: block.gas_limit
        }));
        
        debug('Processed blocks result', { count: result.length });
        return result;
    } catch (error) {
        debug('Error in getLatestBlocks', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function searchBlockchain(query: string) {
    debug(`searchBlockchain called with query: ${query}`);
    try {
        debug('Making API call to /search');
        const response = await useApi('/search', 'get', {
            query: { q: query }
        });
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error searching: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', data);
        
        const results = data.items || [];
        debug(`Processing ${results.length} search results`);
        
        // Limit results to avoid overwhelming responses (max 10 results)
        const limitedResults = results.slice(0, 10);
        debug(`Limited to ${limitedResults.length} results for processing`);
        
        // Process and enhance search results
        const processedResults = limitedResults.map((item: any) => {
            debug('Processing search result item', item);
            
            const result: any = {
                type: item.type,
                name: item.name || 'Unknown',
                priority: item.priority || 0
            };
            
            // Handle different types of search results
            if (item.type === 'address') {
                result.address = item.address_hash || item.address;
                result.isContract = item.is_smart_contract_verified || false;
                result.url = item.url || item.address_url;
                result.certified = item.certified || false;
                
                // Check for ENS info
                if (item.ens_info) {
                    result.ensName = item.ens_info.name;
                    result.ensNamesCount = item.ens_info.names_count;
                }
                
            } else if (item.type === 'ens_domain') {
                result.address = item.address_hash || item.address;
                result.ensName = item.ens_info?.name;
                result.isContract = item.is_smart_contract_verified || false;
                result.url = item.url || item.address_url;
                
                // For ENS lookups, this is the resolved address
                if (query.endsWith('.eth')) {
                    result.ensResolution = `${query} resolves to ${item.address_hash || item.address}`;
                    debug(`ENS resolution found: ${query} -> ${item.address_hash || item.address}`);
                }
                
            } else if (item.type === 'token') {
                result.address = item.address_hash || item.address;
                result.symbol = item.symbol;
                result.tokenType = item.token_type;
                result.url = item.token_url;
                result.totalSupply = item.total_supply;
                result.isVerified = item.is_smart_contract_verified || false;
                result.isVerifiedAdmin = item.is_verified_via_admin_panel || false;
                result.certified = item.certified || false;
                
                // Market data if available
                if (item.circulating_market_cap) {
                    result.marketCap = item.circulating_market_cap;
                }
                if (item.exchange_rate) {
                    result.price = item.exchange_rate;
                }
                if (item.icon_url) {
                    result.iconUrl = item.icon_url;
                }
                
            } else if (item.type === 'transaction') {
                result.hash = item.transaction_hash || item.tx_hash;
                result.url = item.url;
                result.timestamp = item.timestamp;
                
            } else if (item.type === 'block') {
                result.blockNumber = item.block_number;
                result.blockHash = item.block_hash;
                result.url = item.url;
                result.timestamp = item.timestamp;
                result.blockType = item.block_type;
            }
            
            debug('Processed search result', result);
            return result;
        });
        
        // Find resolved address for ENS lookups - check both ens_domain and address types
        let resolvedAddress = null;
        if (query.endsWith('.eth')) {
            const ensResult = limitedResults.find((item: any) => 
                (item.type === 'ens_domain' || item.type === 'address') && 
                ((item as any).address_hash || (item as any).address)
            );
            if (ensResult) {
                resolvedAddress = (ensResult as any).address_hash || (ensResult as any).address;
                debug(`ENS resolution found: ${query} -> ${resolvedAddress}`);
            }
        }
        
        const finalResult = {
            query,
            resultsCount: results.length,
            displayedResults: processedResults.length,
            results: processedResults,
            // Provide a direct address if this was an ENS lookup
            resolvedAddress,
            // Indicate if results were truncated
            truncated: results.length > 10
        };
        
        debug('Final search result', finalResult);
        return finalResult;
    } catch (error) {
        debug('Error in searchBlockchain', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getNetworkStats() {
    debug('getNetworkStats called');
    try {
        debug('Making API call to /stats');
        const response = await useApi('/stats', 'get', {});
        
        debug('API response received', { status: response.status });
        
        if (response.status !== 200) {
            debug(`API error: status ${response.status}`);
            return `❌ Error fetching network stats: ${response.status}`;
        }
        
        const data = response.data;
        debug('Raw API data', data);
        
        const result = {
            totalBlocks: data.total_blocks,
            totalTransactions: data.total_transactions,
            totalAddresses: data.total_addresses,
            averageBlockTime: data.average_block_time,
            networkUtilization: data.network_utilization_percentage
        };
        
        debug('Processed network stats result', result);
        return result;
    } catch (error) {
        debug('Error in getNetworkStats', error);
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

// Function to execute tool calls
async function executeFunction(functionCall: FunctionCall) {
    debug('executeFunction called', functionCall);
    const { name, args } = functionCall;
    
    debug(`Executing function: ${name}`, args);
    
    // Type guard to ensure args is an object with the expected properties
    const safeArgs = args as Record<string, any> || {};
    
    let result;
    switch (name) {
        case 'getAddressInfo':
            result = await getAddressInfo(safeArgs.address);
            break;
        case 'getAddressTransactions':
            result = await getAddressTransactions(safeArgs.address, safeArgs.limit);
            break;
        case 'getAddressTokenBalances':
            result = await getAddressTokenBalances(safeArgs.address);
            break;
        case 'getTokenInfo':
            result = await getTokenInfo(safeArgs.tokenAddress);
            break;
        case 'getTransactionInfo':
            result = await getTransactionInfo(safeArgs.txHash);
            break;
        case 'getLatestBlocks':
            result = await getLatestBlocks(safeArgs.count);
            break;
        case 'searchBlockchain':
            result = await searchBlockchain(safeArgs.query);
            break;
        case 'getNetworkStats':
            result = await getNetworkStats();
            break;
        default:
            result = `❌ Unknown function: ${name}`;
            debug(`Unknown function called: ${name}`);
    }
    
    debug(`Function ${name} completed`, { resultType: typeof result });
    return result;
}

async function runChat(chat: Chat, input: string) {
    debug('Starting runChat', { input, history: chat.getHistory() });
    let response = await chat.sendMessage({
        message: input
    });
    debug('Initial response received', { 
        hasFunctionCalls: !!response.functionCalls?.length,
        hasText: !!response.text,
        response: response
    });

    let rounds = 0;
    debug('Starting function calling loop');

    while (rounds < 5) {
        rounds++;
        const candidate = response.candidates?.find((c) => c.content?.parts);
        if (!candidate) {
            debug('No candidate found, ending function calling loop');
            break;
        }

        const callResults: {
            call: FunctionCall,
            result: any
        }[] = [];

        let text = '';

        for (const part of candidate.content?.parts || []) {
            if (part.text) {
                console.log(`🤖 Assistant:\n${part.text}`);
                text += part.text;
            } else if (part.functionCall) {
                const result = await executeFunction(part.functionCall);
                callResults.push({
                    call: part.functionCall,
                    result
                });
            }
        }

        if (callResults.length > 0) {
            response = await chat.sendMessage({
                message: callResults.map((cr): Part => ({
                    functionResponse: {
                        name: cr.call.name,
                        id: cr.call.id,
                        response: { result: cr.result }
                    }
                }))
            });

            continue;
        } else if (text) {
            return text;
        } else {
            debug('No text found, ending function calling loop');
            return
        }
    }

    debug('Reached maximum rounds, returning final response');
    console.log(`No response from AI`);
}

// Main chat loop
async function startChat() {
    console.log('🤖 Blockchain AI Assistant powered by Gemini & Blockscout');
    console.log('💬 Ask me anything about Ethereum addresses, transactions, tokens, blocks, or network stats!');
    console.log('💡 Examples:');
    console.log('   - "What\'s the balance of vitalik.eth?"');
    console.log('   - "Show me recent transactions for 0x1234..."');
    console.log('   - "What are the latest blocks?"');
    console.log('   - "Search for USDC token"');
    console.log('   - "Get network statistics"');
    console.log('📝 Type "exit" to quit\n');
    
    if (DEBUG) {
        console.log('🐛 DEBUG MODE ENABLED - Verbose logging active');
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const chat = ai.chats.create({
        model: 'gemini-2.0-flash-001',
        config: {
            systemInstruction: SYSTEM_PROMPT,
            toolConfig: {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                }
            },
            tools: [{ functionDeclarations }],
        },
    });

    // const chatHistory: Content[] = [];
    debug('Chat loop started');

    while (true) {
        const userInput = await new Promise<string>((resolve) => {
            rl.question('🧑 You: ', resolve);
        });

        debug(`User input received: "${userInput}"`);

        if (userInput.toLowerCase() === 'exit') {
            console.log('👋 Goodbye!');
            debug('User requested exit');
            break;
        }

        try {
            console.log('🤖 Assistant: Thinking...');
            debug('Starting AI processing');

            await runChat(chat, userInput);

        } catch (error) {
            debug('Error in chat loop', error);
            console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }
    }

    rl.close();
    debug('Chat session ended');
}

// Start the CLI
if (import.meta.main) {
    debug('Starting CLI application');
    startChat().catch((error) => {
        debug('Fatal error in startChat', error);
        console.error(error);
    });
} 
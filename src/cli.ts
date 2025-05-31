import { GoogleGenAI, type FunctionDeclaration, Type, FunctionCallingConfigMode } from '@google/genai';
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
        
        // Process and enhance search results
        const processedResults = results.map((item: any) => {
            debug('Processing search result item', item);
            
            const result: any = {
                type: item.type,
                name: item.name || 'Unknown'
            };
            
            // Handle different types of search results
            if (item.type === 'address' && item.address) {
                result.address = item.address;
                result.isContract = item.is_smart_contract_verified;
                result.url = item.address_url;
                // If this was an ENS search, this is the resolved address
                if (query.endsWith('.eth')) {
                    result.ensResolution = `${query} resolves to ${item.address}`;
                    debug(`ENS resolution found: ${query} -> ${item.address}`);
                }
            } else if (item.type === 'token' && item.address) {
                result.address = item.address;
                result.symbol = item.symbol;
                result.tokenType = item.token_type;
                result.url = item.token_url;
            } else if (item.type === 'transaction' && item.tx_hash) {
                result.hash = item.tx_hash;
                result.url = item.url;
            } else if (item.type === 'block' && item.block_number) {
                result.blockNumber = item.block_number;
                result.url = item.url;
            }
            
            debug('Processed search result', result);
            return result;
        });
        
        // Find resolved address for ENS lookups
        const firstAddressResult = results.find((item: any) => item.type === 'address' && (item as any).address);
        const resolvedAddress = firstAddressResult && query.endsWith('.eth') ? (firstAddressResult as any).address : null;
        
        debug('ENS resolution check', { 
            query, 
            endsWithEth: query.endsWith('.eth'),
            firstAddressResult: firstAddressResult ? 'found' : 'not found',
            resolvedAddress 
        });
        
        const finalResult = {
            query,
            resultsCount: results.length,
            results: processedResults,
            // Provide a direct address if this was an ENS lookup
            resolvedAddress
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
async function executeFunction(functionCall: any) {
    debug('executeFunction called', functionCall);
    const { name, args } = functionCall;
    
    debug(`Executing function: ${name}`, args);
    
    let result;
    switch (name) {
        case 'getAddressInfo':
            result = await getAddressInfo(args.address);
            break;
        case 'getAddressTransactions':
            result = await getAddressTransactions(args.address, args.limit);
            break;
        case 'getAddressTokenBalances':
            result = await getAddressTokenBalances(args.address);
            break;
        case 'getTokenInfo':
            result = await getTokenInfo(args.tokenAddress);
            break;
        case 'getTransactionInfo':
            result = await getTransactionInfo(args.txHash);
            break;
        case 'getLatestBlocks':
            result = await getLatestBlocks(args.count);
            break;
        case 'searchBlockchain':
            result = await searchBlockchain(args.query);
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

    const chatHistory: any[] = [];
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

            // Add user message to history
            chatHistory.push({
                role: 'user',
                parts: [{ text: userInput }]
            });
            debug('Added user message to chat history', { historyLength: chatHistory.length });

            // Generate response with function calling
            debug('Calling Gemini AI with function calling enabled');
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-001',
                contents: chatHistory,
                config: {
                    toolConfig: {
                        functionCallingConfig: {
                            mode: FunctionCallingConfigMode.AUTO
                        }
                    },
                    tools: [{ functionDeclarations }]
                }
            });

            debug('Gemini AI response received', { 
                hasFunctionCalls: !!(response.functionCalls && response.functionCalls.length > 0),
                functionCallsCount: response.functionCalls?.length || 0,
                hasText: !!response.text
            });

            let assistantMessage = '';
            
            // Check for function calls
            if (response.functionCalls && response.functionCalls.length > 0) {
                debug('Processing function calls', response.functionCalls);
                const functionResults = [];
                
                for (const functionCall of response.functionCalls) {
                    console.log(`🔧 Executing: ${functionCall.name}...`);
                    debug(`Executing function call: ${functionCall.name}`, functionCall);
                    
                    const result = await executeFunction(functionCall);
                    functionResults.push({
                        name: functionCall.name,
                        result: JSON.stringify(result, null, 2)
                    });
                    
                    debug(`Function call ${functionCall.name} completed`);
                }

                debug('All function calls completed', { resultsCount: functionResults.length });

                // Add function call to history
                chatHistory.push({
                    role: 'model',
                    parts: response.functionCalls.map((fc: any) => ({
                        functionCall: fc
                    }))
                });
                debug('Added function calls to chat history');

                // Add function responses to history
                chatHistory.push({
                    role: 'user',
                    parts: functionResults.map(fr => ({
                        functionResponse: {
                            name: fr.name,
                            response: { result: fr.result }
                        }
                    }))
                });
                debug('Added function responses to chat history');

                // Generate final response based on function results
                debug('Generating final AI response based on function results');
                const finalResponse = await ai.models.generateContent({
                    model: 'gemini-2.0-flash-001',
                    contents: chatHistory,
                    config: {
                        toolConfig: {
                            functionCallingConfig: {
                                mode: FunctionCallingConfigMode.AUTO
                            }
                        },
                        tools: [{ functionDeclarations }]
                    }
                });

                assistantMessage = finalResponse.text || 'No response generated';
                debug('Final AI response generated', { hasText: !!finalResponse.text });
            } else {
                assistantMessage = response.text || 'No response generated';
                debug('Direct AI response (no function calls)', { hasText: !!response.text });
            }

            console.log(`🤖 Assistant: ${assistantMessage}\n`);
            
            // Add assistant response to history
            chatHistory.push({
                role: 'model',
                parts: [{ text: assistantMessage }]
            });
            debug('Added assistant response to chat history', { historyLength: chatHistory.length });

            // Keep history manageable (last 20 exchanges)
            if (chatHistory.length > 40) {
                chatHistory.splice(0, chatHistory.length - 40);
                debug('Trimmed chat history to keep it manageable', { newLength: chatHistory.length });
            }

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
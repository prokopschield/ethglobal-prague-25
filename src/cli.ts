import { GoogleGenAI, type FunctionDeclaration, Type, FunctionCallingConfigMode } from '@google/genai';
import { useApi } from './api';
import * as readline from 'readline';

// Initialize Google Gen AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ Please set GEMINI_API_KEY environment variable');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Function declarations for Gemini
const functionDeclarations: FunctionDeclaration[] = [
    {
        name: 'getAddressInfo',
        description: 'Get basic information about an Ethereum address including balance, transaction count, and type',
        parameters: {
            type: Type.OBJECT,
            properties: {
                address: {
                    type: Type.STRING,
                    description: 'Ethereum address (0x...)'
                }
            },
            required: ['address']
        }
    },
    {
        name: 'getAddressTransactions',
        description: 'Get recent transactions for an Ethereum address',
        parameters: {
            type: Type.OBJECT,
            properties: {
                address: {
                    type: Type.STRING,
                    description: 'Ethereum address (0x...)'
                },
                limit: {
                    type: Type.NUMBER,
                    description: 'Number of transactions to retrieve (default: 10)'
                }
            },
            required: ['address']
        }
    },
    {
        name: 'getAddressTokenBalances',
        description: 'Get token balances for an Ethereum address',
        parameters: {
            type: Type.OBJECT,
            properties: {
                address: {
                    type: Type.STRING,
                    description: 'Ethereum address (0x...)'
                }
            },
            required: ['address']
        }
    },
    {
        name: 'getTokenInfo',
        description: 'Get information about a specific token by its contract address',
        parameters: {
            type: Type.OBJECT,
            properties: {
                tokenAddress: {
                    type: Type.STRING,
                    description: 'Token contract address (0x...)'
                }
            },
            required: ['tokenAddress']
        }
    },
    {
        name: 'getTransactionInfo',
        description: 'Get detailed information about a specific transaction',
        parameters: {
            type: Type.OBJECT,
            properties: {
                txHash: {
                    type: Type.STRING,
                    description: 'Transaction hash (0x...)'
                }
            },
            required: ['txHash']
        }
    },
    {
        name: 'getLatestBlocks',
        description: 'Get information about the latest blocks on the blockchain',
        parameters: {
            type: Type.OBJECT,
            properties: {
                count: {
                    type: Type.NUMBER,
                    description: 'Number of latest blocks to retrieve (default: 5)'
                }
            }
        }
    },
    {
        name: 'searchBlockchain',
        description: 'Search for addresses, transactions, blocks, or tokens',
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: 'Search query (address, tx hash, block number, token name, etc.)'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'getNetworkStats',
        description: 'Get overall network statistics and metrics',
        parameters: {
            type: Type.OBJECT,
            properties: {}
        }
    }
];

// Tool function implementations
async function getAddressInfo(address: string) {
    try {
        const response = await useApi('/addresses/{address_hash}', 'get', {
            path: { address_hash: address }
        });
        
        if (response.status !== 200) {
            return `❌ Error fetching address info: ${response.status}`;
        }
        
        const data = response.data;
        return {
            address: data.hash,
            balance: data.coin_balance || '0',
            type: data.is_contract ? 'Contract' : 'EOA (Externally Owned Account)',
            verified: data.is_verified || false
        };
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getAddressTransactions(address: string, limit: number = 10) {
    try {
        const response = await useApi('/addresses/{address_hash}/transactions', 'get', {
            path: { address_hash: address }
        });
        
        if (response.status !== 200) {
            return `❌ Error fetching transactions: ${response.status}`;
        }
        
        const data = response.data;
        const transactions = data.items?.slice(0, limit) || [];
        
        return transactions.map((tx: any) => ({
            hash: tx.hash,
            from: tx.from?.hash,
            to: tx.to?.hash,
            value: tx.value,
            gasUsed: tx.gas_used,
            status: tx.status,
            timestamp: tx.timestamp,
            method: tx.method
        }));
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getAddressTokenBalances(address: string) {
    try {
        const response = await useApi('/addresses/{address_hash}/token-balances', 'get', {
            path: { address_hash: address }
        });
        
        if (response.status !== 200) {
            return `❌ Error fetching token balances: ${response.status}`;
        }
        
        const data = response.data;
        return data.map((balance: any) => ({
            token: {
                name: balance.token.name,
                symbol: balance.token.symbol,
                address: balance.token.address
            },
            value: balance.value,
            valueFloat: balance.value_float
        }));
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getTokenInfo(tokenAddress: string) {
    try {
        const response = await useApi('/tokens/{address_hash}', 'get', {
            path: { address_hash: tokenAddress }
        });
        
        if (response.status !== 200) {
            return `❌ Error fetching token info: ${response.status}`;
        }
        
        const data = response.data;
        return {
            name: data.name,
            symbol: data.symbol,
            decimals: data.decimals,
            totalSupply: data.total_supply,
            holderCount: data.holders,
            transferCount: 'N/A',
            type: data.type
        };
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getTransactionInfo(txHash: string) {
    try {
        const response = await useApi('/transactions/{transaction_hash}', 'get', {
            path: { transaction_hash: txHash }
        });
        
        if (response.status !== 200) {
            return `❌ Error fetching transaction: ${response.status}`;
        }
        
        const data = response.data;
        return {
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
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getLatestBlocks(count: number = 5) {
    try {
        const response = await useApi('/blocks', 'get', {});
        
        if (response.status !== 200) {
            return `❌ Error fetching blocks: ${response.status}`;
        }
        
        const data = response.data;
        const blocks = data.items?.slice(0, count) || [];
        
        return blocks.map((block: any) => ({
            number: block.height,
            hash: block.hash,
            timestamp: block.timestamp,
            transactionCount: block.transaction_count,
            miner: block.miner?.hash,
            gasUsed: block.gas_used,
            gasLimit: block.gas_limit
        }));
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function searchBlockchain(query: string) {
    try {
        const response = await useApi('/search', 'get', {
            query: { q: query }
        });
        
        if (response.status !== 200) {
            return `❌ Error searching: ${response.status}`;
        }
        
        const data = response.data;
        return {
            query,
            results: data.items || [],
        };
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getNetworkStats() {
    try {
        const response = await useApi('/stats', 'get', {});
        
        if (response.status !== 200) {
            return `❌ Error fetching network stats: ${response.status}`;
        }
        
        const data = response.data;
        return {
            totalBlocks: data.total_blocks,
            totalTransactions: data.total_transactions,
            totalAddresses: data.total_addresses,
            averageBlockTime: data.average_block_time,
            networkUtilization: data.network_utilization_percentage
        };
    } catch (error) {
        return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

// Function to execute tool calls
async function executeFunction(functionCall: any) {
    const { name, args } = functionCall;
    
    switch (name) {
        case 'getAddressInfo':
            return await getAddressInfo(args.address);
        case 'getAddressTransactions':
            return await getAddressTransactions(args.address, args.limit);
        case 'getAddressTokenBalances':
            return await getAddressTokenBalances(args.address);
        case 'getTokenInfo':
            return await getTokenInfo(args.tokenAddress);
        case 'getTransactionInfo':
            return await getTransactionInfo(args.txHash);
        case 'getLatestBlocks':
            return await getLatestBlocks(args.count);
        case 'searchBlockchain':
            return await searchBlockchain(args.query);
        case 'getNetworkStats':
            return await getNetworkStats();
        default:
            return `❌ Unknown function: ${name}`;
    }
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

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const chatHistory: any[] = [];

    while (true) {
        const userInput = await new Promise<string>((resolve) => {
            rl.question('🧑 You: ', resolve);
        });

        if (userInput.toLowerCase() === 'exit') {
            console.log('👋 Goodbye!');
            break;
        }

        try {
            console.log('🤖 Assistant: Thinking...');

            // Add user message to history
            chatHistory.push({
                role: 'user',
                parts: [{ text: userInput }]
            });

            // Generate response with function calling
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

            let assistantMessage = '';
            
            // Check for function calls
            if (response.functionCalls && response.functionCalls.length > 0) {
                const functionResults = [];
                
                for (const functionCall of response.functionCalls) {
                    console.log(`🔧 Executing: ${functionCall.name}...`);
                    const result = await executeFunction(functionCall);
                    functionResults.push({
                        name: functionCall.name,
                        result: JSON.stringify(result, null, 2)
                    });
                }

                // Add function call to history
                chatHistory.push({
                    role: 'model',
                    parts: response.functionCalls.map((fc: any) => ({
                        functionCall: fc
                    }))
                });

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

                // Generate final response based on function results
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
            } else {
                assistantMessage = response.text || 'No response generated';
            }

            console.log(`🤖 Assistant: ${assistantMessage}\n`);
            
            // Add assistant response to history
            chatHistory.push({
                role: 'model',
                parts: [{ text: assistantMessage }]
            });

            // Keep history manageable (last 20 exchanges)
            if (chatHistory.length > 40) {
                chatHistory.splice(0, chatHistory.length - 40);
            }

        } catch (error) {
            console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }
    }

    rl.close();
}

// Start the CLI
if (import.meta.main) {
    startChat().catch(console.error);
} 
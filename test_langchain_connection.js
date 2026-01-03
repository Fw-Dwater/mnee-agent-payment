import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
import https from "https";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// 强制禁用全局 SSL 验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testLangChainConnection() {
    console.log("🔍 Testing LangChain DeepSeek Connection...");
    
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });

    try {
        const model = new ChatOpenAI({ 
            modelName: "deepseek-chat", 
            temperature: 0,
            configuration: {
                baseURL: "https://api.deepseek.com",
                httpAgent: httpsAgent,
            },
            openAIApiKey: process.env.DEEPSEEK_API_KEY,
            verbose: true
        });

        console.log("🤖 Sending request via LangChain...");
        const response = await model.invoke("Hello, say 'LangChain OK'.");
        console.log("✅ Response:", response.content);

    } catch (error) {
        console.error("❌ LangChain Connection Failed!");
        console.error(error);
    }
}

testLangChainConnection();

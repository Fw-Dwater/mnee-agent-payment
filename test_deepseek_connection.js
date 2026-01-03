import https from 'https';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 显式加载当前目录下的 .env 文件
dotenv.config({ path: path.join(__dirname, '.env') });

// 创建忽略 SSL 错误的 Agent
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// 初始化 OpenAI 客户端 (直接使用官方 SDK，模拟 agent.js 中的底层调用)
const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
    httpAgent: httpsAgent // 显式传入 httpAgent
});

async function testConnection() {
    console.log("🔍 Testing DeepSeek API Connection...");
    console.log("🔑 API Key:", process.env.DEEPSEEK_API_KEY ? "Present" : "Missing");
    console.log("🌐 Base URL: https://api.deepseek.com");

    try {
        const completion = await client.chat.completions.create({
            messages: [{ role: "user", content: "Hello, just testing the connection. Say 'OK'." }],
            model: "deepseek-chat",
        });

        console.log("✅ Connection Successful!");
        console.log("📝 Response:", completion.choices[0].message.content);
    } catch (error) {
        console.error("❌ Connection Failed!");
        console.error("Error Code:", error.code);
        console.error("Error Message:", error.message);
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Data:", error.response.data);
        }
    }
}

testConnection();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_FILE = path.join(__dirname, 'agent_memory.json');

export class MemoryManager {
    constructor() {
        this.data = {
            subscriptions: [],
            transactions: [],
            preferences: {}
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(MEMORY_FILE)) {
                const rawData = fs.readFileSync(MEMORY_FILE, 'utf8');
                const json = JSON.parse(rawData);
                // Merge with default structure to ensure backward compatibility
                this.data = { ...this.data, ...json };
                console.log(`🧠 Memory Loaded: ${this.data.subscriptions.length} subs, ${this.data.transactions.length} txs.`);
            } else {
                this.save();
            }
        } catch (error) {
            console.error("❌ Failed to load memory:", error);
        }
    }

    save() {
        try {
            const content = JSON.stringify({
                updated_at: new Date().toISOString(),
                ...this.data
            }, null, 2);
            fs.writeFileSync(MEMORY_FILE, content, 'utf8');
            console.log(`💾 Memory Saved.`);
        } catch (error) {
            console.error("❌ Failed to save memory:", error);
        }
    }

    // --- Subscription Management ---
    addSubscription(address) {
        if (!address) return;
        const lowerAddr = address.toLowerCase();
        if (!this.data.subscriptions.includes(lowerAddr)) {
            this.data.subscriptions.push(lowerAddr);
            this.save();
        }
    }

    hasSubscription(address) {
        if (!address) return false;
        return this.data.subscriptions.includes(address.toLowerCase());
    }

    // --- Transaction History ---
    addTransaction(tx) {
        this.data.transactions.push({
            timestamp: new Date().toISOString(),
            ...tx
        });
        this.save();
    }

    getTransactions(limit = 5) {
        // Return last N transactions
        return this.data.transactions.slice(-limit).reverse();
    }

    // --- User Preferences / Context ---
    setPreference(key, value) {
        this.data.preferences[key] = value;
        this.save();
    }

    getPreference(key) {
        return this.data.preferences[key];
    }

    getAllPreferences() {
        return this.data.preferences;
    }
}

import fs from 'fs';
import path from 'path';

export interface TransactionRecord {
    hash: string;
    type: 'transfer' | 'approve' | 'refund' | 'split';
    from: string;
    to: string; // or multiple for split
    amount: string;
    timestamp: number;
    status: 'success' | 'failed';
}

export class TransactionLogger {
    private filePath: string;

    constructor(storageDir: string = './data') {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        this.filePath = path.join(storageDir, 'transactions.json');
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify([]));
        }
    }

    private readLogs(): TransactionRecord[] {
        try {
            const data = fs.readFileSync(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error("Failed to read transaction logs:", error);
            return [];
        }
    }

    private writeLogs(logs: TransactionRecord[]) {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error("Failed to write transaction logs:", error);
        }
    }

    public async logTransaction(record: TransactionRecord) {
        const logs = this.readLogs();
        logs.push(record);
        this.writeLogs(logs);
    }

    public async getHistory(limit: number = 10): Promise<TransactionRecord[]> {
        const logs = this.readLogs();
        // Return latest first
        return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }
}

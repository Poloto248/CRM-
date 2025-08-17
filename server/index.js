import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
const PORT = 3001;

const INITIAL_BOARD_DATA = {
  cards: {},
  columns: {
    'numbers-list': { id: 'numbers-list', title: 'لیست شماره ها', cardIds: [] },
    'contact-failed': { id: 'contact-failed', title: 'عدم برقرار تماس', cardIds: [] },
    'needs-action': { id: 'needs-action', title: 'نیاز به اقدام', cardIds: [] },
    'needs-follow-up': { id: 'needs-follow-up', title: 'نیاز به آموزش و پیگیری', cardIds: [] },
    'customer': { id: 'customer', title: 'مشتری', cardIds: [] },
  },
  columnOrder: ['numbers-list', 'contact-failed', 'needs-action', 'needs-follow-up', 'customer'],
};

let db;

async function loadDb() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        db = JSON.parse(data);
        console.log("Database loaded successfully from db.json.");
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("No database file found, initializing with default data.");
            db = INITIAL_BOARD_DATA;
            await saveDb();
        } else {
            console.error("Error loading database:", error);
            process.exit(1);
        }
    }
}

async function saveDb() {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error saving to database:", error);
    }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/data', (req, res) => {
    res.json(db);
});

app.post('/api/data', async (req, res) => {
    const newData = req.body;
    if (!newData || !newData.cards || !newData.columns || !newData.columnOrder) {
        return res.status(400).json({ error: 'Invalid data structure' });
    }
    db = newData;
    await saveDb();
    res.status(200).json({ message: 'Data saved successfully' });
});

loadDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);
    });
});

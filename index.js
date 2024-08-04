import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { simulateMax } from './runeUtils.js';
import bodyParser from 'body-parser';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({
    origin: 'https://sw-rune-analyzer.vercel.app'
}));
app.use(express.json());

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const validateJson = (req, res, next) => {
    const rawData = req.file.buffer.toString('utf-8');
    let data;
    try {
        data = JSON.parse(rawData);
    } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON format' });
    }

    if (data.command !== 'HubUserLogin') {
        console.log('Invalid command value');
        return res.status(400).json({ error: 'Invalid JSON format' });
    }
    if (!Array.isArray(data.runes)) {
        console.log('"runes" should be an array');
        return res.status(400).json({ error: 'Invalid JSON format' });
    }
    if (!Array.isArray(data.unit_list)) {
        console.log('"unit_list" should be an array');
        return res.status(400).json({ error: 'Invalid JSON format' });
    }

    req.validatedJson = data;
    next();
};

app.post('/upload', upload.single('file'), validateJson, async (req, res) => {
    try {
        const data = req.validatedJson;
        const { runes, unit_list } = data;
        const mobsRunes = unit_list.flatMap(mob => mob.runes);
        const allRunes = [...runes, ...mobsRunes];

        let allRunesConfig = [];
        allRunes.forEach(rune => {
            const runeConfigs = simulateMax(rune);
            allRunesConfig.push(runeConfigs);
        });

        allRunesConfig.sort((a, b) => b.best.efficiencyMax - a.best.efficiencyMax);

        res.json(allRunesConfig);
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

const PORT = 4200;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
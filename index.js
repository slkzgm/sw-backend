import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { simulateMax } from './runeUtils.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const corsOptions = {
    origin: 'https://sw-rune-analyzer.vercel.app',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

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

const validateQuality = (req, res, next) => {
    const quality = parseInt(req.body.quality);
    if (!quality || isNaN(quality) || quality < 1 || quality > 5) {
        req.quality = 5;
    } else {
        req.quality = quality;
    }
    next();
};

const validateRunesArray = (req, res, next) => {
    const { runes } = req.body;
    if (!Array.isArray(runes)) {
        console.log('"runes" should be an array');
        return res.status(400).json({ error: 'Invalid runes array format' });
    }
    req.validatedRunes = runes;
    next();
};

app.get('/', (req, res) => {
    res.json('HELLO SUMMONER') ;
});

app.post('/upload', upload.single('file'), validateJson, validateQuality, async (req, res) => {
    try {
        const data = req.validatedJson;
        const { runes, unit_list } = data;
        const quality = req.quality || 5;
        const mobsRunes = unit_list.flatMap(mob =>
            mob.runes.map(rune => ({ ...rune, occupiedId: mob.unit_id }))
        );
        const allRunes = [...runes, ...mobsRunes];

        let allRunesConfig = [];
        allRunes.forEach(rune => {
            const runeConfigs = simulateMax(rune, quality, unit_list);
            allRunesConfig.push(runeConfigs);
        });

        allRunesConfig.sort((a, b) => b.best.efficiencyMax - a.best.efficiencyMax);

        res.json(allRunesConfig);
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

app.post('/get-efficiency', validateRunesArray, async (req, res) => {
    try {
        const runes = req.validatedRunes;

        const allRunes = runes.map(rune => {
            const effLegMax = simulateMax(rune, 5).best.efficiencyMax;
            const effHeroMax = simulateMax(rune, 5).best.efficiencyMax;
            const formatted = effLegMax.base[0]

            formatted.efficiencyMaxLeg = effLegMax;
            formatted.efficiencyMaxHero = effHeroMax;

            return formatted;
        });

        res.json(allRunes);
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

const PORT = 4200;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
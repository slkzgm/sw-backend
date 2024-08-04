import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import {simulateMax, getMostEfficientConfig, logRune} from './runeUtils.js';

const app = express();
const upload = multer({ dest: 'uploads/' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const filePath = path.join(__dirname, req.file.path);
        const rawData = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(rawData);

        const { runes, unit_list } = data;
        const mobsRunes = unit_list.flatMap(mob => mob.runes);
        const allRunes = [...runes, ...mobsRunes];

        let allRunesConfig = [];
        allRunes.forEach(rune => {
            const runeConfigs = simulateMax(rune);
            const bestConfig = getMostEfficientConfig(runeConfigs);
            allRunesConfig.push({ original: rune, bestConfig });
        });

        allRunesConfig.sort((a, b) => b.bestConfig.efficiencyMax - a.bestConfig.efficiencyMax);

        res.json(allRunesConfig.slice(0, 50).map(config => logRune(config.bestConfig)));
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

const PORT = 4200;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
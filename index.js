import { promises as fs } from 'fs';
import * as utils from "./mapping.js";

async function loadJson() {
    try {
        const rawData = await fs.readFile('./exampleJson.json', 'utf-8');
        return JSON.parse(rawData);
    } catch (err) {
        console.error(err);
    }
}

const STAT_INDICES = {
    HP_FLAT: 1,
    ATK_FLAT: 3,
    DEF_FLAT: 5,
    HP_PERCENT: 2,
    ATK_PERCENT: 4,
    DEF_PERCENT: 6,
    SPEED: 8,
    CRI_RATE: 9,
    CRI_DMG: 10,
    RESIST: 11,
    ACCURACY: 12
};

function atLeastOneAvailable(prohibitedStats, statsToCheck) {
    return statsToCheck.some(value => !prohibitedStats.includes(value));
}

function logRune(rune) {
    const isAncient = utils.isAncient(rune);
    const efficiency = utils.getRuneEfficiency(rune);

    return {
        set: utils.runeData.sets[rune.set_id],
        slot: rune.slot_no,
        ancient: isAncient,
        stars: isAncient ? rune.class - 10 : rune.class,
        level: rune.upgrade_curr,
        quality: utils.runeData.quality[rune.rank],
        primary: utils.getRuneEffect(rune.pri_eff),
        innate: utils.getRuneEffect(rune.prefix_eff),
        secondary: rune.sec_eff.map(eff => {
            const base = utils.getRuneEffect(eff);
            const enhance = eff[3] > 0 ? `(+${eff[3]})` : '';
            const gem = eff[2] === 1 ? '⟳' : '';
            return base + enhance + gem;
        }),
        efficiency,
        efficiencyMax: Number(efficiency.max)
    }
}

function logConfigs(config) {
    return {
        percent: config.percents.map(logRune),
        speed: config.speed.map(logRune),
        flat: config.flat.map(logRune),
        others: config.others.map(logRune)
    }
}

function applyMaxGrinds(rune) {
    const newRune = { ...rune, sec_eff: rune.sec_eff.map(eff => [...eff]) };
    newRune.sec_eff.forEach(eff => {
        eff[3] = eff[0] <= 8 ? utils.grindstone[eff[0]].range[5].max : 0;
    });
    return newRune;
}

function updateRuneWithNewStat(rune, enchantedIndex, newStat) {
    const newRune = { ...rune, sec_eff: rune.sec_eff.map(arr => [...arr]) }; // Deep copy only the necessary part
    newRune.sec_eff[enchantedIndex][0] = newStat;
    newRune.sec_eff[enchantedIndex][1] = utils.enchanted_gem[newStat].range[5].max;
    newRune.sec_eff[enchantedIndex][2] = 1;
    const maxGrindedRune = applyMaxGrinds(newRune);
    maxGrindedRune.efficiencyMax = Number(utils.getRuneEfficiency(maxGrindedRune).max);
    return maxGrindedRune;
}

function calculatePercents(rune, enchantedIndex, prohibitedStats) {
    const results = [];
    if (atLeastOneAvailable(prohibitedStats, [STAT_INDICES.HP_PERCENT, STAT_INDICES.ATK_PERCENT, STAT_INDICES.DEF_PERCENT])) {
        const newStat = [STAT_INDICES.HP_PERCENT, STAT_INDICES.ATK_PERCENT, STAT_INDICES.DEF_PERCENT].filter(statType => !prohibitedStats.includes(statType))[0];
        results.push(updateRuneWithNewStat(rune, enchantedIndex, newStat));
    }
    return results;
}

function calculateSpeed(rune, enchantedIndex, prohibitedStats) {
    const results = [];
    if (!prohibitedStats.includes(STAT_INDICES.SPEED)) {
        const newStat = STAT_INDICES.SPEED;
        results.push(updateRuneWithNewStat(rune, enchantedIndex, newStat));
    }
    return results;
}

function calculateFlat(rune, enchantedIndex, prohibitedStats) {
    const results = [];
    if (atLeastOneAvailable(prohibitedStats, [STAT_INDICES.HP_FLAT, STAT_INDICES.ATK_FLAT, STAT_INDICES.DEF_FLAT])) {
        const newStat = [STAT_INDICES.HP_FLAT, STAT_INDICES.ATK_FLAT, STAT_INDICES.DEF_FLAT].filter(statType => !prohibitedStats.includes(statType))[0];
        results.push(updateRuneWithNewStat(rune, enchantedIndex, newStat));
    }
    return results;
}

function calculateOthers(rune, enchantedIndex, prohibitedStats) {
    const results = [];
    if (atLeastOneAvailable(prohibitedStats, [STAT_INDICES.CRI_RATE, STAT_INDICES.CRI_DMG, STAT_INDICES.RESIST, STAT_INDICES.ACCURACY])) {
        const newStat = [STAT_INDICES.CRI_RATE, STAT_INDICES.CRI_DMG, STAT_INDICES.RESIST, STAT_INDICES.ACCURACY].filter(statType => !prohibitedStats.includes(statType))[0];
        results.push(updateRuneWithNewStat(rune, enchantedIndex, newStat));
    }
    return results;
}

function simulateMax(rune) {
    const { pri_eff, prefix_eff, sec_eff } = rune;

    const enchanted = sec_eff.findIndex(eff => eff[2] === 1); // return already enchanted stat index, or -1 if none
    let prohibitedStats = [pri_eff[0], prefix_eff[0]]; // array that tells which stats can't be used as gems for this rune

    // APPLY PROHIBITED STATS FOR SLOTS 1 & 3
    switch (rune.slot_no) {
        case 1:
            prohibitedStats.push(STAT_INDICES.DEF_FLAT, STAT_INDICES.DEF_PERCENT);
            break;
        case 3:
            prohibitedStats.push(STAT_INDICES.ATK_FLAT, STAT_INDICES.ATK_PERCENT);
            break;
    }

    const maxGrindedRune = applyMaxGrinds(rune);
    maxGrindedRune.efficiencyMax = Number(utils.getRuneEfficiency(maxGrindedRune).max);
    const config = {
        base: [maxGrindedRune],
        percents: [],
        speed: [],
        flat: [],
        others: []
    };

    if (enchanted !== -1) {
        // ADD STATS FROM OTHER LINES TO PROHIBITED
        sec_eff
            .filter((_, index) => index !== enchanted)
            .map(subArray => prohibitedStats.push(subArray[0]));

        config.percents.push(...calculatePercents(rune, enchanted, prohibitedStats));
        config.speed.push(...calculateSpeed(rune, enchanted, prohibitedStats));
        config.flat.push(...calculateFlat(rune, enchanted, prohibitedStats));
        config.others.push(...calculateOthers(rune, enchanted, prohibitedStats));
    } else {
        // TEST ON EVERY LINE
        sec_eff.forEach((_, index) => {
            let currentProhibitedStats = [...prohibitedStats];
            sec_eff.filter((_, idx) => idx !== index).forEach(subArray => currentProhibitedStats.push(subArray[0]));

            config.percents.push(...calculatePercents(rune, index, currentProhibitedStats));
            config.speed.push(...calculateSpeed(rune, index, currentProhibitedStats));
            config.flat.push(...calculateFlat(rune, index, currentProhibitedStats));
            config.others.push(...calculateOthers(rune, index, currentProhibitedStats));
        });
    }

    // SORT DESC PER EFFICIENCY MAX
    config.percents.sort((a, b) => b.efficiencyMax - a.efficiencyMax);
    config.speed.sort((a, b) => b.efficiencyMax - a.efficiencyMax);
    config.flat.sort((a, b) => b.efficiencyMax - a.efficiencyMax);
    config.others.sort((a, b) => b.efficiencyMax - a.efficiencyMax);

    return config;
}

function getMostEfficientConfig(runeConfigs) {
    let mostEfficientConfig;

    Object.keys(runeConfigs).forEach(configType => {
        if (!mostEfficientConfig || runeConfigs[configType][0] && runeConfigs[configType][0].efficiencyMax > mostEfficientConfig.efficiencyMax)
            mostEfficientConfig = runeConfigs[configType][0];
    })
    return mostEfficientConfig;
}

(async () => {
    const {
        wizard_info, // summoner info
        unit_list, // mob list
        unit_collection, // mob collection
        runes, // runes
        rune_craft_item_list,
        artifacts,
        artifact_crafts,
        account_info // hiveId info
    } = await loadJson();

    console.log(rune_craft_item_list.length);

    const mobsRunes = unit_list.flatMap(mob => mob.runes);
    const allRunes = [...runes, ...mobsRunes];

    // const runeTest = allRunes.filter(rune => rune.set_id === 4 && rune.slot_no === 4 && rune.upgrade_curr === 0)[0];
    // const runeTestConfigs = simulateMax(runeTest);

    // console.log(logRune(runeTest));
    // console.log(logConfigs(runeTestConfigs));
    // console.log(JSON.stringify(logConfigs(runeTestConfigs), null, 2));

    // const bestConfig = getMostEfficientConfig(runeTestConfigs);
    // console.log(logRune(bestConfig));

    let index = 0;
    allRunes.forEach(rune => {
        index++;
        const runeConfigs = simulateMax(rune);
        const bestConfig = getMostEfficientConfig(runeConfigs);
        console.log(logRune(rune));
        console.log(logRune(bestConfig));
    });
    console.log(`${index} runes scrolled`);
})();
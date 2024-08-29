import * as utils from "./mapping.js";

// GEM AND GRINDS TO USE GLOBAL VAR
let gemsAndGrindsQuality = 5;
let unitList = [];

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

export function formatRune(rune) {
    const isAncient = utils.isAncient(rune);
    const efficiency = utils.getRuneEfficiency(rune);
    const location = unitList.length && rune.occupiedId ? utils.getMonsterName(unitList.filter(unit => unit.unit_id === rune.occupiedId)[0].unit_master_id) : 'storage'

    return {
        id: rune.rune_id,
        set: utils.runeData.sets[rune.set_id],
        slot: rune.slot_no,
        ancient: isAncient,
        stars: isAncient ? rune.class - 10 : rune.class,
        level: rune.upgrade_curr,
        quality: utils.runeData.quality[rune.extra],
        rank: rune.rank,
        primary: utils.getRuneEffect(rune.pri_eff),
        innate: utils.getRuneEffect(rune.prefix_eff),
        secondary: rune.sec_eff.map(eff => {
            const base = utils.getRuneEffect(eff);
            const enhance = eff[3] > 0 ? `(+${eff[3]})` : '';
            const gem = eff[2] === 1 ? '⟳' : '';
            return base + enhance + gem;
        }),
        efficiency,
        efficiencyCurrent: Number(efficiency.current),
        efficiencyMax: Number(efficiency.max),
        occupiedId: rune.occupied_id || 0,
        location: location
    }
}

function logConfigs(config) {
    return {
        percent: config.percents.map(formatRune),
        speed: config.speed.map(formatRune),
        flat: config.flat.map(formatRune),
        others: config.others.map(formatRune)
    }
}

function applyMaxGrinds(rune) {
    const newRune = { ...rune, sec_eff: rune.sec_eff.map(eff => [...eff]) };
    newRune.sec_eff.forEach(eff => {
        eff[3] = eff[0] <= 8 ? utils.grindstone[eff[0]].range[gemsAndGrindsQuality].max : 0;
    });
    return newRune;
}

function updateRuneWithNewStat(rune, enchantedIndex, newStat) {
    const newRune = { ...rune, sec_eff: rune.sec_eff.map(arr => [...arr]) }; // Deep copy only the necessary part
    newRune.sec_eff[enchantedIndex][0] = newStat;
    newRune.sec_eff[enchantedIndex][1] = utils.enchanted_gem[newStat].range[gemsAndGrindsQuality].max;
    newRune.sec_eff[enchantedIndex][2] = 1;
    const maxGrindedRune = applyMaxGrinds(newRune);
    const efficiency = utils.getRuneEfficiency(maxGrindedRune);
    maxGrindedRune.efficiencyMax = Number(efficiency.max);
    maxGrindedRune.efficiencyCurrent = Number(efficiency.current);
    return formatRune(maxGrindedRune);
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

export function simulateMax(rune, quality, unit_list) {
    gemsAndGrindsQuality = quality;
    unitList = unit_list;

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
        base: [formatRune(rune), formatRune(maxGrindedRune)],
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

    // ADD BEST CONFIG
    config.best = getMostEfficientConfig(config);

    return config;
}

export function getMostEfficientConfig(runeConfigs) {
    let mostEfficientConfig;

    Object.keys(runeConfigs).forEach(configType => {
        if (!mostEfficientConfig || runeConfigs[configType][0] && runeConfigs[configType][0].efficiencyMax > mostEfficientConfig.efficiencyMax)
            mostEfficientConfig = runeConfigs[configType][0];
    })
    return mostEfficientConfig;
}
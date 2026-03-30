const {
    formatTimeForTimezone,
    formatTimeForUTCOffset,
    parseUTCOffset,
    findCountry,
} = require('../../domain/timezone/timezoneUtils.js');

async function handleTimeCommand(inputs = []) {
    try {
        const now = new Date();
        const results = [];

        if (inputs.length > 0) {
            for (const input of inputs) {
                const utcOffset = parseUTCOffset(input);
                if (utcOffset !== null) {
                    const formatted = formatTimeForUTCOffset(now, utcOffset);
                    results.push({
                        name: `UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`,
                        time: formatted
                    });
                    console.log(`[Time] UTC offset: "${input}" -> UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`);
                } else {
                    const country = findCountry(input);
                    if (country && !results.find(c => c.name === country.name)) {
                        const formatted = formatTimeForTimezone(now, country.tz);
                        if (formatted) {
                            results.push({
                                name: country.name,
                                time: formatted
                            });
                        }
                    }
                }
            }
        }

        const standardTimes = {
            utc: now.toUTCString(),
            iso: now.toISOString(),
            timestamp: Math.floor(now.getTime() / 1000)
        };

        return {
            times: results,
            standard: standardTimes
        };
    } catch (error) {
        console.error('Failed to handle time command:', error);
        throw error;
    }
}

module.exports = {
    handleTimeCommand
};

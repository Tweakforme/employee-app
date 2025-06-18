const { WorkHour } = require('./models');

(async () => {
    const entries = await WorkHour.findAll();

    for (const entry of entries) {
        if (typeof entry.projects === 'string') {
            try {
                const parsed = JSON.parse(entry.projects);

                // Force wrap into array if not already one
                const safeArray = Array.isArray(parsed) ? parsed : [parsed];

                entry.projects = safeArray;
                await entry.save();

                console.log(`Fixed entry ID: ${entry.id}`);
            } catch (err) {
                console.error(`Failed to parse entry ID ${entry.id}:`, err.message);
            }
        } else {
            console.log(`entry ID ${entry.id} already good.`);
        }
    }

    console.log("? All project entries checked.");
    process.exit();
})();

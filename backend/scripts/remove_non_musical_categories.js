const fs = require('fs');
const path = require('path');

const grammysPath = path.join(__dirname, '../../oscar-frontend/public/grammys.json');

const categoriesToRemove = [
    "Best Recording Package",
    "Best Album Cover",
    "Best Album Notes",
    "Best Music Video",
    "Best Music Film",
    "Producer Of The Year, Non-Classical",
    "Songwriter Of The Year, Non-Classical",
    "Producer, Classical",
    "Best Audio Book"
];

try {
    if (!fs.existsSync(grammysPath)) {
        console.error("❌ File not found:", grammysPath);
        process.exit(1);
    }

    const grammys = JSON.parse(fs.readFileSync(grammysPath, 'utf8'));
    let originalCount = 0;
    let newCount = 0;

    // Count total categories before
    grammys.fields.forEach(field => {
        originalCount += field.categories.length;
    });

    // Filter categories
    grammys.fields.forEach(field => {
        field.categories = field.categories.filter(category => {
            const shouldRemove = categoriesToRemove.includes(category.name);
            if (shouldRemove) {
                console.log(`🗑️  Removing: ${category.name}`);
            }
            return !shouldRemove;
        });
    });

    // Count total categories after
    grammys.fields.forEach(field => {
        newCount += field.categories.length;
    });

    // Remove empty fields if any
    grammys.fields = grammys.fields.filter(field => {
        if (field.categories.length === 0) {
            console.log(`⚠️  Removing empty field: ${field.field_name}`);
            return false;
        }
        return true;
    });

    fs.writeFileSync(grammysPath, JSON.stringify(grammys, null, 2));

    console.log(`\n🎉 Done!`);
    console.log(`Removed ${originalCount - newCount} categories.`);
    console.log(`Total categories remaining: ${newCount}`);

} catch (error) {
    console.error("Error processing file:", error);
}

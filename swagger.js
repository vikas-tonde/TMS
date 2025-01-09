import swaggerAutogen from 'swagger-autogen';

const doc = {
    info: {
        title: 'TMS API',
        description: 'Description'
    },
    host: 'localhost:5000',
    tags: [
        {
            "name": "V1", 
            "description": "This is version one which is designed with NoSQL database i.e., mongodb",
        },
        {
            "name": "V2",
            "description": "This is version two which is designed with SQL database i.e., PostgresSQL"
        }
    ]
};
const outFile = './swagger-output.json';
const routes = ['./routes/index.js', './V2/routes/index.js'];
await swaggerAutogen()(outFile, routes, doc);
import fs from 'fs';
import path from 'path';

// Path to the generated Swagger output
const outputFile = './swagger-output.json';

// Read the generated Swagger output
fs.readFile(outputFile, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading Swagger output:', err);
        return;
    }

    const swaggerDoc = JSON.parse(data);

    // Loop through all paths and add tags based on path prefix
    for (const [path, pathObject] of Object.entries(swaggerDoc.paths)) {
        if (path.startsWith('/api/')) {
            // Assign V1 tag to paths starting with "/api/"
            for (const method of Object.values(pathObject)) {
                method.tags = ['V1'];
            }
        } else if (path.startsWith('/v2/api/')) {
            // Assign V2 tag to paths starting with "/v2/api/"
            for (const method of Object.values(pathObject)) {
                method.tags = ['V2'];
            }
        }
    }

    // Write the modified Swagger document back to the file
    fs.writeFile(outputFile, JSON.stringify(swaggerDoc, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing modified Swagger output:', err);
        } else {
            console.log('Swagger output successfully updated with version tags!');
        }
    });
});

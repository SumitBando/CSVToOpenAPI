import * as fs from 'fs';
import * as csv from 'fast-csv';
import * as yaml from 'js-yaml';

interface Column {
  enumValues: any[];
  name: string;
  type: string;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: {
    [path: string]: {
      get: {
        summary: string;
        parameters: { name: string; in: string; schema: { type?: string; enum?: any[] } }[];
        responses: {
          '200': {
            description: string;
            content: { 'application/json': { example: object } };
          };
        };
      };
    };
  };
}

function generateOpenAPIFromCSV(filePath: string): OpenAPISpec {
  // Read the CSV input file
  const csvData = fs.readFileSync(filePath, 'utf-8');

  // Parse the CSV data
  const records: any[] = [];
  let columns: Column[] = [];

  csv.parseString(csvData, { headers: true })
    .on('data', (data) => records.push(data))
    .on('headers', (header) => {
      columns = header.map((name:string) => ({ name, type: 'string' }));
    })
    .on('end', () => {
      // Analyze data types based on the content of each column
      columns.forEach((column) => {
        const values = records.map((record) => record[column.name]);
        const uniqueValues = [...new Set(values)];

        // Deduce data type
        if (values.every(Number.isInteger)) {
          column.type = 'integer';
        } else if (values.every((val) => typeof val === 'number')) {
          column.type = 'number';
        } else if (uniqueValues.length < values.length / 4) {
          column.type = 'string';
          column.enumValues = uniqueValues;
        } else {
          column.type = 'string';
        }
      });

      // guess item name based on filename
      const itemName = `${filePath.replace('.csv', '')}`;
      // Generate OpenAP specification
      const openAPI: OpenAPISpec = {
        openapi: '3.0.0',
        info: {
          title: `Access ${itemName}`,
          version: '1.0.0',
        },
        paths: {},
      };

      // Create path based on input filename
      const path = `/${itemName}`;

      // Create OpenAPI path definition
      openAPI.paths[path] = {
        get: {
          summary: `Get all ${itemName}s`,
          parameters: columns.map((column) => {
            const parameter: {
              name: string;
              in: string;
              schema: { type: string; enum?: any[] };
            } = {
              name: column.name,
              in: 'query',
              schema: { type: column.type },
            };
      
            // Include enum directly in the schema only if the column is of type 'enum'
            if (column.type === 'string' && column.enumValues) {
              parameter.schema.enum = column.enumValues;
            }
      
            return parameter;
          }),
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  example: records.length > 0 ? records[0] : {},
                },
              },
            },
          },
        },
      };

      // Convert OpenAPI object to YAML
      const yamlString = yaml.dump(openAPI);

      // Save the YAML to a file
      const yamlFile = `${itemName}.yaml`
      fs.writeFileSync(yamlFile, yamlString);
      console.log(`OpenAPI specification generated and saved as ${yamlFile}`);
    });

  return {} as OpenAPI; // Dummy return to satisfy TypeScript
}

// Read the CSV file name from the command line arguments
if (process.argv.length <= 2) {
  console.error("Usage: node CSVToOpenAPI {your}.csv")
  process.exit(0)
}
const csvFileName = process.argv[2]; // Assuming the CSV file name is the first argument
// csvFileName = 'example.csv'
generateOpenAPIFromCSV(csvFileName);

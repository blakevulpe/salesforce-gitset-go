import { promisify } from 'util';
import { exec } from 'child_process';
import { executeSfCommand } from '../utils/sfCommandExecutor';

const execAsync = promisify(exec);

/**
 * Fetch all custom settings from Salesforce org
 */
export async function fetchCustomSettings(): Promise<string[]> {
	const { stdout, stderr } = await execAsync(
		'sf data query --query "SELECT QualifiedApiName, DeveloperName, Label FROM EntityDefinition WHERE IsCustomSetting = true" --json'
	);

	if (stderr) {
		console.error('Salesforce CLI stderr:', stderr);
	}

	const result = JSON.parse(stdout);
	
	if (result.status !== 0) {
		throw new Error(result.message || 'Query failed');
	}

	if (result.result && result.result.records && Array.isArray(result.result.records)) {
		return result.result.records.map((record: any) => record.QualifiedApiName);
	}
	
	return [];
}

/**
 * Fetch records for a specific custom setting type.
 *
 * Notes:
 * - List custom settings commonly have Name.
 * - Hierarchy custom settings often don't; they use SetupOwnerId.
 */
export async function fetchRecordsForType(
	settingType: string
): Promise<Array<{ Id: string; Name?: string; SetupOwnerId?: string }>> {
	try {
		const query = `SELECT Id, Name, SetupOwnerId FROM ${settingType}`;
		const { stdout } = await execAsync(`sf data query --query "${query}" --json`);

		const result = JSON.parse(stdout);
		if (result.status === 0 && result.result && result.result.records) {
			return result.result.records;
		}
		return [];
	} catch (error) {
		console.error(`Error fetching records for ${settingType}:`, error);
		return [];
	}
}

/**
 * Fetch field names for a custom setting using Tooling API
 */
export async function fetchFieldsForSetting(settingName: string): Promise<string[]> {
	const fieldQuery = `SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${settingName}'`;
	
	const fieldStdout = await executeSfCommand([
		'data',
		'query',
		'--use-tooling-api',
		'--query',
		fieldQuery,
		'--json'
	]);

	const fieldResult = JSON.parse(fieldStdout);

	if (fieldResult.status !== 0) {
		throw new Error(`Failed to fetch fields for ${settingName}: ${fieldResult.message || 'Unknown error'}`);
	}

	let allFields: string[] = [];
	if (fieldResult.result && fieldResult.result.records && Array.isArray(fieldResult.result.records)) {
		allFields = fieldResult.result.records.map((record: any) => record.QualifiedApiName);
	}

	if (allFields.length === 0) {
		throw new Error(`No fields found for Custom Setting: ${settingName}`);
	}

	// Filter fields to only include custom fields and Name
	const fields = allFields.filter(field =>
		field.endsWith('__c') || field === 'Name'
	);

	if (fields.length === 0) {
		throw new Error(`No custom fields found for Custom Setting: ${settingName}`);
	}

	return fields;
}

/**
 * Export custom setting data to a directory
 */
export async function exportCustomSettingData(
	settingName: string,
	fields: string[],
	outputDir: string,
	whereClause?: string
): Promise<void> {
	const selectClause = fields.join(', ');
	let dataQuery = `SELECT ${selectClause} FROM ${settingName}`;
	
	if (whereClause) {
		dataQuery += ` WHERE ${whereClause}`;
	}
	
	console.log('Exporting data for:', settingName);
	
	await executeSfCommand([
		'data',
		'export',
		'tree',
		'--query',
		dataQuery,
		'--output-dir',
		outputDir,
		'--plan'
	]);
}

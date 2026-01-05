import * as vscode from 'vscode';
import * as fs from 'fs';
import { fetchFieldsForSetting, exportCustomSettingData } from '../services/salesforceService';
import { getYamlFilePath, readCustomSettingsYaml, ensureCustomSettingDirectory } from '../services/yamlService';

/**
 * Command handler for retrieving custom settings data
 */
export async function retrieveCustomSettingsDataCommand(uri?: vscode.Uri): Promise<void> {
	try {
		console.log('retrieveCustomSettingsData called with uri:', uri);
		
		// Get workspace root first
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder is open.');
			return;
		}
		
		if (!workspaceFolders[0] || !workspaceFolders[0].uri) {
			vscode.window.showErrorMessage('Invalid workspace folder configuration.');
			return;
		}
		
		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		console.log('Workspace root:', workspaceRoot);
		
		// Get the YAML file path
		let yamlFilePath: string;
		
		if (uri && uri.fsPath) {
			// URI was passed from context menu
			yamlFilePath = uri.fsPath;
			console.log('Using URI from context menu:', yamlFilePath);
		} else {
			// No URI passed, try to find the file in the workspace
			yamlFilePath = getYamlFilePath(workspaceRoot);
			console.log('Constructed YAML path:', yamlFilePath);
		}
		
		if (!fs.existsSync(yamlFilePath)) {
			vscode.window.showErrorMessage('custom-settings.yaml file not found.');
			return;
		}

		// Parse the YAML file
		const customSettings = readCustomSettingsYaml(yamlFilePath);

		if (customSettings.length === 0) {
			vscode.window.showInformationMessage('No Custom Settings found in custom-settings.yaml.');
			return;
		}

		// Process each Custom Setting
		let successCount = 0;
		let errorCount = 0;
		const errors: string[] = [];

		for (const settingName of customSettings) {
			try {
				// Fetch field names using Tooling API
				const fields = await fetchFieldsForSetting(settingName);
				console.log(`Filtered fields for ${settingName}:`, fields);

				// Define output directory
				const outputDir = ensureCustomSettingDirectory(workspaceRoot, settingName);

				// Execute data export command
				await exportCustomSettingData(settingName, fields, outputDir);

				successCount++;
			} catch (error) {
				errorCount++;
				const errorMessage = error instanceof Error ? error.message : String(error);
				errors.push(`${settingName}: ${errorMessage}`);
				console.error(`Error retrieving data for ${settingName}:`, errorMessage);
			}
		}

		// Display summary message
		if (errorCount === 0) {
			vscode.window.showInformationMessage(
				`Successfully retrieved data for ${successCount} Custom Setting(s).`
			);
		} else if (successCount === 0) {
			vscode.window.showErrorMessage(
				`Failed to retrieve data for all ${errorCount} Custom Setting(s). Check the output for details.`
			);
			// Log errors to output channel
			console.error('Errors:', errors.join('\n'));
		} else {
			vscode.window.showWarningMessage(
				`Retrieved data for ${successCount} Custom Setting(s), but ${errorCount} failed. Check the output for details.`
			);
			// Log errors to output channel
			console.error('Errors:', errors.join('\n'));
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Error retrieving Custom Settings data: ${errorMessage}`);
		console.error('Error in retrieveCustomSettingsData:', errorMessage);
	}
}

/**
 * Retrieve selected records for custom settings
 * Used by showCustomSettings command
 */
export async function retrieveSelectedRecords(
	workspaceRoot: string,
	recordsToRetrieve: { type: string; recordIds: string[] }[]
): Promise<{ successCount: number; errorCount: number }> {
	let successCount = 0;
	let errorCount = 0;

	for (const { type: settingName, recordIds } of recordsToRetrieve) {
		try {
			// Fetch field names using Tooling API
			const fields = await fetchFieldsForSetting(settingName);

			// Build WHERE clause for selected records
			const whereClause = `Id IN ('${recordIds.join("','")}')`;

			// Define output directory
			const outputDir = ensureCustomSettingDirectory(workspaceRoot, settingName);

			// Execute data export command
			await exportCustomSettingData(settingName, fields, outputDir, whereClause);

			successCount++;
		} catch (error) {
			errorCount++;
			console.error(`Error retrieving ${settingName}:`, error);
		}
	}

	return { successCount, errorCount };
}

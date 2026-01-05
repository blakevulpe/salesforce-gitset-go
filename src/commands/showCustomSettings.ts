import * as vscode from 'vscode';
import { fetchCustomSettings, fetchRecordsForType } from '../services/salesforceService';
import { getYamlFilePath, readCustomSettingsYaml, updateSettingsInYaml, ensureCustomSettingDirectory } from '../services/yamlService';
import { getWebviewContent } from '../ui/customSettingsWebview';
import { retrieveSelectedRecords } from './retrieveCustomSettingsData';

/**
 * Command handler for showing custom settings selector
 */
export async function showCustomSettingsCommand(context: vscode.ExtensionContext): Promise<void> {
	// Fetch Custom Settings from Salesforce
	let customSettings: string[] = [];
	
	try {
		customSettings = await fetchCustomSettings();
		
		if (customSettings.length === 0) {
			vscode.window.showInformationMessage('No Custom Settings found in the authenticated Salesforce org.');
			return;
		}
	} catch (error) {
		// Handle errors from the Salesforce CLI command
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		// Check for common error scenarios
		if (errorMessage.includes('sf: command not found') || errorMessage.includes('not recognized')) {
			vscode.window.showErrorMessage('Salesforce CLI (sf) is not installed or not in PATH. Please install the Salesforce CLI.');
		} else if (errorMessage.includes('No authorization found') || errorMessage.includes('not authenticated')) {
			vscode.window.showErrorMessage('Not authenticated to a Salesforce org. Please run "sf org login" to authenticate.');
		} else {
			vscode.window.showErrorMessage(`Error fetching Custom Settings: ${errorMessage}`);
		}
		return;
	}

	// Get workspace root path
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder is open.');
		return;
	}
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	// Read existing YAML file to get already selected settings
	const yamlFilePath = getYamlFilePath(workspaceRoot);
	const existingSettings = readCustomSettingsYaml(yamlFilePath);

	// Create and show the WebView panel
	const panel = vscode.window.createWebviewPanel(
		'customSettingsSelector',
		'Select Custom Settings',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	// Set the HTML content
	panel.webview.html = getWebviewContent(customSettings, existingSettings);

	// Handle messages from the webview
	panel.webview.onDidReceiveMessage(
		async message => {
			switch (message.command) {
				case 'fetchRecords':
					await handleFetchRecords(panel, message.types);
					break;
				
				case 'retrieveSelectedRecords':
					await handleRetrieveSelectedRecords(panel, workspaceRoot, message.records);
					break;
				
				case 'saveSettings':
					await handleSaveSettings(panel, workspaceRoot, message.settings);
					break;
			}
		},
		undefined,
		context.subscriptions
	);
}

/**
 * Handle fetching records for selected custom setting types
 */
async function handleFetchRecords(panel: vscode.WebviewPanel, selectedTypes: string[]): Promise<void> {
	try {
		const allRecords: { [key: string]: any[] } = {};
		
		// Fetch records for each selected custom setting type
		for (const settingType of selectedTypes) {
			allRecords[settingType] = await fetchRecordsForType(settingType);
		}
		
		// Send records back to webview
		panel.webview.postMessage({
			command: 'displayRecords',
			records: allRecords
		});
	} catch (error) {
		vscode.window.showErrorMessage(`Error fetching records: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Handle retrieving selected records
 */
async function handleRetrieveSelectedRecords(
	panel: vscode.WebviewPanel,
	workspaceRoot: string,
	recordsToRetrieve: { type: string; recordIds: string[] }[]
): Promise<void> {
	try {
		// First, save the selected types to the YAML file
		const selectedTypes = recordsToRetrieve.map(r => r.type);
		const yamlFilePath = getYamlFilePath(workspaceRoot);
		updateSettingsInYaml(yamlFilePath, selectedTypes);
		
		// Now retrieve the selected records
		const { successCount, errorCount } = await retrieveSelectedRecords(workspaceRoot, recordsToRetrieve);
		
		// Show success message
		if (errorCount === 0) {
			vscode.window.showInformationMessage(
				`Successfully retrieved data for ${successCount} custom setting type(s).`
			);
		} else {
			vscode.window.showWarningMessage(
				`Retrieved ${successCount} type(s), but ${errorCount} failed.`
			);
		}
		
		// Close the panel
		panel.dispose();
	} catch (error) {
		vscode.window.showErrorMessage(`Error retrieving records: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Handle saving settings to YAML file
 */
async function handleSaveSettings(
	panel: vscode.WebviewPanel,
	workspaceRoot: string,
	selectedSettings: string[]
): Promise<void> {
	try {
		const yamlFilePath = getYamlFilePath(workspaceRoot);

		// Create data subdirectories for each setting
		for (const selectedSetting of selectedSettings) {
			ensureCustomSettingDirectory(workspaceRoot, selectedSetting);
		}

		// Update the YAML file
		const { added, removed } = updateSettingsInYaml(yamlFilePath, selectedSettings);

		// Display appropriate message
		const messages: string[] = [];
		if (added.length > 0) {
			messages.push(`Added ${added.length} setting(s)`);
		}
		if (removed.length > 0) {
			messages.push(`Removed ${removed.length} setting(s)`);
		}
		
		if (messages.length > 0) {
			vscode.window.showInformationMessage(
				messages.join(', ') + ' in custom-settings.yaml'
			);
		} else {
			vscode.window.showInformationMessage(
				'No changes made to custom-settings.yaml'
			);
		}

		// Close the panel
		panel.dispose();
	} catch (error) {
		vscode.window.showErrorMessage(`Error processing custom settings: ${error instanceof Error ? error.message : String(error)}`);
	}
}

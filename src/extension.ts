// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to execute sf commands with proper argument handling
function executeSfCommand(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		console.log('Executing sf command with args:', args);
		
		// Build the command string with proper quoting
		// Quote arguments that contain spaces or special characters
		const quotedArgs = args.map(arg => {
			// If the argument contains spaces, quotes, or special chars, wrap it in quotes
			if (arg.includes(' ') || arg.includes("'") || arg.includes('"')) {
				// Escape any existing double quotes and wrap in double quotes
				return `"${arg.replace(/"/g, '\\"')}"`;
			}
			return arg;
		});
		
		const commandString = `sf ${quotedArgs.join(' ')}`;
		console.log('Full command:', commandString);
		
		// Use exec instead of spawn for better shell compatibility
		exec(commandString, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				const errorMsg = stderr || stdout || error.message;
				console.error('Command failed:', errorMsg);
				console.error('Command was:', commandString);
				reject(new Error(errorMsg));
			} else {
				resolve(stdout);
			}
		});
	});
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "salesforce-gitset-go" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('salesforce-gitset-go.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Salesforce GitSet Go!');
	});

	context.subscriptions.push(disposable);

	// Register the showCustomSettings command
	const showCustomSettingsDisposable = vscode.commands.registerCommand('salesforce-gitset-go.showCustomSettings', async () => {
		// Fetch Custom Settings from Salesforce
		let customSettings: string[] = [];
		
		try {
			// Execute Salesforce CLI command to fetch Custom Settings
			const { stdout, stderr } = await execAsync(
				'sf data query --query "SELECT QualifiedApiName, DeveloperName, Label FROM EntityDefinition WHERE IsCustomSetting = true" --json'
			);

			if (stderr) {
				console.error('Salesforce CLI stderr:', stderr);
			}

			// Parse the JSON output
			const result = JSON.parse(stdout);
			
			// Check if the query was successful
			if (result.status !== 0) {
				throw new Error(result.message || 'Query failed');
			}

			// Extract QualifiedApiName values from the records
			if (result.result && result.result.records && Array.isArray(result.result.records)) {
				customSettings = result.result.records.map((record: any) => record.QualifiedApiName);
				
				// Check if any custom settings were found
				if (customSettings.length === 0) {
					vscode.window.showInformationMessage('No Custom Settings found in the authenticated Salesforce org.');
					return;
				}
			} else {
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

		// Display Quick Pick list
		const selectedSetting = await vscode.window.showQuickPick(customSettings, {
			placeHolder: 'Select a Custom Setting'
		});

		// Process the selected setting
		if (selectedSetting) {
			try {
				// Get the workspace root path
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (!workspaceFolders || workspaceFolders.length === 0) {
					vscode.window.showErrorMessage('No workspace folder is open.');
					return;
				}
				const workspaceRoot = workspaceFolders[0].uri.fsPath;

				// Define paths
				const yamlFilePath = path.join(workspaceRoot, 'force-app', 'main', 'default', '.custom-settings', 'custom-settings.yaml');
				const dataSubdirectory = path.join(workspaceRoot, 'force-app', 'main', 'default', 'custom-settings', selectedSetting);

				// Ensure the data subdirectory exists
				if (!fs.existsSync(dataSubdirectory)) {
					fs.mkdirSync(dataSubdirectory, { recursive: true });
				}

				// Read or create the YAML file
				let yamlContent: any;
				if (!fs.existsSync(yamlFilePath)) {
					// Create the parent directory if it doesn't exist
					const yamlDir = path.dirname(yamlFilePath);
					if (!fs.existsSync(yamlDir)) {
						fs.mkdirSync(yamlDir, { recursive: true });
					}
					// Create the file with default content
					yamlContent = { CustomSettingsDataKeys: [] };
					fs.writeFileSync(yamlFilePath, 'CustomSettingsDataKeys:\n', 'utf8');
				} else {
					// Read and parse existing YAML file
					const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
					yamlContent = yaml.load(fileContent) || { CustomSettingsDataKeys: [] };
				}

				// Ensure CustomSettingsDataKeys exists and is an array
				if (!yamlContent.CustomSettingsDataKeys) {
					yamlContent.CustomSettingsDataKeys = [];
				}

				// Add the selected setting to the list if not already present
				if (!yamlContent.CustomSettingsDataKeys.includes(selectedSetting)) {
					yamlContent.CustomSettingsDataKeys.push(selectedSetting);

					// Write the updated content back to the YAML file
					const updatedYaml = yaml.dump(yamlContent);
					fs.writeFileSync(yamlFilePath, updatedYaml, 'utf8');

					vscode.window.showInformationMessage(`Custom setting '${selectedSetting}' has been added to custom-settings.yaml`);
				} else {
					vscode.window.showInformationMessage(`Custom setting '${selectedSetting}' is already in custom-settings.yaml`);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Error processing custom setting: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	});

	context.subscriptions.push(showCustomSettingsDisposable);

	// Register the retrieveCustomSettingsData command
	const retrieveCustomSettingsDataDisposable = vscode.commands.registerCommand(
		'salesforce-gitset-go.retrieveCustomSettingsData',
		async (uri?: vscode.Uri) => {
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
					yamlFilePath = path.join(workspaceRoot, 'force-app', 'main', 'default', '.custom-settings', 'custom-settings.yaml');
					console.log('Constructed YAML path:', yamlFilePath);
				}
				
				if (!fs.existsSync(yamlFilePath)) {
					vscode.window.showErrorMessage('custom-settings.yaml file not found.');
					return;
				}

				// Parse the YAML file
				const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
				const yamlContent = yaml.load(fileContent) as any;

				// Validate the YAML structure
				if (!yamlContent || !yamlContent.CustomSettingsDataKeys || !Array.isArray(yamlContent.CustomSettingsDataKeys)) {
					vscode.window.showErrorMessage('Invalid custom-settings.yaml format. Expected CustomSettingsDataKeys array.');
					return;
				}

				const customSettings = yamlContent.CustomSettingsDataKeys as string[];

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
						// Step 1: Fetch field names using Tooling API
						const fieldQuery = `SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${settingName}'`;
						
						console.log('Fetching fields for:', settingName);
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

						// Extract field names
						let allFields: string[] = [];
						if (fieldResult.result && fieldResult.result.records && Array.isArray(fieldResult.result.records)) {
							allFields = fieldResult.result.records.map((record: any) => record.QualifiedApiName);
						}

						if (allFields.length === 0) {
							throw new Error(`No fields found for Custom Setting: ${settingName}`);
						}

						// Filter fields to only include custom fields and Name
						// Exclude system fields that don't exist on Custom Settings
						const excludedFields = [
							'Id', 'IsDeleted', 'CurrencyIsoCode', 'SetupOwnerId',
							'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById',
							'SystemModstamp', 'UserRecordAccessId', 'RecordVisibilityId'
						];
						
						const fields = allFields.filter(field =>
							field.endsWith('__c') || field === 'Name'
						);

						if (fields.length === 0) {
							throw new Error(`No custom fields found for Custom Setting: ${settingName}`);
						}

						console.log(`Filtered fields for ${settingName}:`, fields);

						// Step 2: Construct SELECT clause
						const selectClause = fields.join(', ');

						// Step 3: Define output directory
						const outputDir = path.join(workspaceRoot, 'force-app', 'main', 'default', 'custom-settings', settingName);

						// Ensure output directory exists
						if (!fs.existsSync(outputDir)) {
							fs.mkdirSync(outputDir, { recursive: true });
						}

						// Step 4: Execute data export command
						const dataQuery = `SELECT ${selectClause} FROM ${settingName}`;
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
	);

	context.subscriptions.push(retrieveCustomSettingsDataDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

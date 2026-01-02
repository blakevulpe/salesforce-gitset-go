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

		// Get workspace root path
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder is open.');
			return;
		}
		const workspaceRoot = workspaceFolders[0].uri.fsPath;

		// Read existing YAML file to get already selected settings
		const yamlFilePath = path.join(workspaceRoot, 'force-app', 'main', 'default', '.custom-settings', 'custom-settings.yaml');
		let existingSettings: string[] = [];
		
		if (fs.existsSync(yamlFilePath)) {
			try {
				const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
				const yamlContent = yaml.load(fileContent) as any;
				if (yamlContent && yamlContent.CustomSettingsDataKeys && Array.isArray(yamlContent.CustomSettingsDataKeys)) {
					existingSettings = yamlContent.CustomSettingsDataKeys;
				}
			} catch (error) {
				console.error('Error reading existing YAML file:', error);
			}
		}

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
						try {
							const selectedTypes = message.types as string[];
							const allRecords: { [key: string]: any[] } = {};
							
							// Fetch records for each selected custom setting type
							for (const settingType of selectedTypes) {
								try {
									const query = `SELECT Id, Name FROM ${settingType}`;
									const { stdout } = await execAsync(
										`sf data query --query "${query}" --json`
									);
									
									const result = JSON.parse(stdout);
									if (result.status === 0 && result.result && result.result.records) {
										allRecords[settingType] = result.result.records;
									} else {
										allRecords[settingType] = [];
									}
								} catch (error) {
									console.error(`Error fetching records for ${settingType}:`, error);
									allRecords[settingType] = [];
								}
							}
							
							// Send records back to webview
							panel.webview.postMessage({
								command: 'displayRecords',
								records: allRecords
							});
						} catch (error) {
							vscode.window.showErrorMessage(`Error fetching records: ${error instanceof Error ? error.message : String(error)}`);
						}
						break;
					
					case 'retrieveSelectedRecords':
						try {
							const recordsToRetrieve = message.records as { type: string; recordIds: string[] }[];
							
							// First, save the selected types to the YAML file
							const selectedTypes = recordsToRetrieve.map(r => r.type);
							const yamlFilePath = path.join(workspaceRoot, 'force-app', 'main', 'default', '.custom-settings', 'custom-settings.yaml');
							
							// Read or create the YAML file
							let yamlContent: any;
							if (!fs.existsSync(yamlFilePath)) {
								const yamlDir = path.dirname(yamlFilePath);
								if (!fs.existsSync(yamlDir)) {
									fs.mkdirSync(yamlDir, { recursive: true });
								}
								yamlContent = { CustomSettingsDataKeys: [] };
							} else {
								const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
								yamlContent = yaml.load(fileContent) || { CustomSettingsDataKeys: [] };
							}
							
							// Update the YAML file with selected types
							yamlContent.CustomSettingsDataKeys = selectedTypes;
							const updatedYaml = yaml.dump(yamlContent);
							fs.writeFileSync(yamlFilePath, updatedYaml, 'utf8');
							
							// Now retrieve the selected records
							let successCount = 0;
							let errorCount = 0;
							
							for (const { type: settingName, recordIds } of recordsToRetrieve) {
								try {
									// Fetch field names using Tooling API
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
										throw new Error(`Failed to fetch fields for ${settingName}`);
									}
									
									// Extract and filter field names
									let allFields: string[] = [];
									if (fieldResult.result && fieldResult.result.records) {
										allFields = fieldResult.result.records.map((record: any) => record.QualifiedApiName);
									}
									
									const fields = allFields.filter(field =>
										field.endsWith('__c') || field === 'Name'
									);
									
									if (fields.length === 0) {
										throw new Error(`No custom fields found for ${settingName}`);
									}
									
									// Build WHERE clause for selected records
									const whereClause = `Id IN ('${recordIds.join("','")}')`;
									const selectClause = fields.join(', ');
									const dataQuery = `SELECT ${selectClause} FROM ${settingName} WHERE ${whereClause}`;
									
									// Define output directory
									const outputDir = path.join(workspaceRoot, 'force-app', 'main', 'default', 'custom-settings', settingName);
									if (!fs.existsSync(outputDir)) {
										fs.mkdirSync(outputDir, { recursive: true });
									}
									
									// Execute data export command
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
									console.error(`Error retrieving ${settingName}:`, error);
								}
							}
							
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
						break;
					
					case 'saveSettings':
						try {
							const selectedSettings = message.settings as string[];
							
							// Define paths
							const yamlFilePath = path.join(workspaceRoot, 'force-app', 'main', 'default', '.custom-settings', 'custom-settings.yaml');

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
							} else {
								// Read and parse existing YAML file
								const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
								yamlContent = yaml.load(fileContent) || { CustomSettingsDataKeys: [] };
							}

							// Ensure CustomSettingsDataKeys exists and is an array
							if (!yamlContent.CustomSettingsDataKeys) {
								yamlContent.CustomSettingsDataKeys = [];
							}

							// Track changes
							const addedSettings: string[] = [];
							const removedSettings: string[] = [];
							const previousSettings = [...yamlContent.CustomSettingsDataKeys];

							// Process each selected setting (add new ones)
							for (const selectedSetting of selectedSettings) {
								// Create data subdirectory for each setting
								const dataSubdirectory = path.join(workspaceRoot, 'force-app', 'main', 'default', 'custom-settings', selectedSetting);
								if (!fs.existsSync(dataSubdirectory)) {
									fs.mkdirSync(dataSubdirectory, { recursive: true });
								}

								// Add the selected setting to the list if not already present
								if (!yamlContent.CustomSettingsDataKeys.includes(selectedSetting)) {
									yamlContent.CustomSettingsDataKeys.push(selectedSetting);
									addedSettings.push(selectedSetting);
								}
							}

							// Remove unchecked settings
							for (const previousSetting of previousSettings) {
								if (!selectedSettings.includes(previousSetting)) {
									removedSettings.push(previousSetting);
								}
							}

							// Update the array to only include selected settings
							yamlContent.CustomSettingsDataKeys = selectedSettings;

							// Write the updated content back to the YAML file
							const updatedYaml = yaml.dump(yamlContent);
							fs.writeFileSync(yamlFilePath, updatedYaml, 'utf8');

							// Display appropriate message
							const messages: string[] = [];
							if (addedSettings.length > 0) {
								messages.push(`Added ${addedSettings.length} setting(s)`);
							}
							if (removedSettings.length > 0) {
								messages.push(`Removed ${removedSettings.length} setting(s)`);
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
						break;
				}
			},
			undefined,
			context.subscriptions
		);
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

// Function to generate the WebView HTML content
function getWebviewContent(customSettings: string[], existingSettings: string[]): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Select Custom Settings</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			padding: 20px;
			margin: 0;
		}
		h1 {
			font-size: 24px;
			font-weight: 600;
			margin-bottom: 10px;
		}
		.description {
			color: var(--vscode-descriptionForeground);
			margin-bottom: 20px;
			font-size: 13px;
		}
		.settings-container {
			display: flex;
			flex-direction: column;
			gap: 8px;
			margin-bottom: 20px;
		}
		.setting-item {
			display: flex;
			align-items: center;
			padding: 8px 12px;
			background-color: var(--vscode-list-inactiveSelectionBackground);
			border-radius: 4px;
			cursor: pointer;
			transition: background-color 0.1s;
		}
		.setting-item:hover {
			background-color: var(--vscode-list-hoverBackground);
		}
		.setting-item input[type="checkbox"] {
			margin-right: 10px;
			cursor: pointer;
			width: 16px;
			height: 16px;
		}
		.setting-item label {
			cursor: pointer;
			flex: 1;
			font-size: 13px;
		}
		.setting-item.already-selected {
			opacity: 0.6;
		}
		.setting-item.already-selected label::after {
			content: " (already added)";
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}
		.button-container {
			display: flex;
			gap: 10px;
			margin-top: 20px;
		}
		button {
			padding: 8px 16px;
			font-size: 13px;
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-family: var(--vscode-font-family);
		}
		.primary-button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.primary-button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		.primary-button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.secondary-button {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		.secondary-button:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		.selection-info {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			margin-top: 10px;
		}
	</style>
</head>
<body>
	<h1>Select Custom Settings</h1>
	<p class="description">
		Choose one or more custom settings to add to your custom-settings.yaml file.
		Settings already in the file are marked and can be skipped.
	</p>
	
	<div style="margin-bottom: 15px;">
		<input
			type="text"
			id="searchInput"
			placeholder="Search custom settings..."
			style="
				width: 100%;
				padding: 8px 12px;
				font-size: 13px;
				font-family: var(--vscode-font-family);
				background-color: var(--vscode-input-background);
				color: var(--vscode-input-foreground);
				border: 1px solid var(--vscode-input-border);
				border-radius: 2px;
				box-sizing: border-box;
			"
		/>
	</div>
	
	<div class="settings-container" id="settingsContainer">
		${customSettings.map(setting => {
			const isExisting = existingSettings.includes(setting);
			return `
			<div class="setting-item ${isExisting ? 'already-selected' : ''}">
				<input type="checkbox" id="${setting}" value="${setting}" ${isExisting ? 'checked' : ''}>
				<label for="${setting}">${setting}</label>
			</div>
			`;
		}).join('')}
	</div>
	
	<div class="selection-info" id="selectionInfo">
		0 settings selected
	</div>
	
	<div class="button-container">
		<button class="primary-button" id="saveButton" onclick="saveSettings()">
			Add Selected Settings
		</button>
		<button class="secondary-button" onclick="selectAll()">
			Select All
		</button>
		<button class="secondary-button" onclick="deselectAll()">
			Deselect All
		</button>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		function toggleCheckbox(settingName) {
			const checkbox = document.getElementById(settingName);
			checkbox.checked = !checkbox.checked;
			updateSelectionInfo();
		}
		
		function updateSelectionInfo() {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
			const count = checkboxes.length;
			const info = document.getElementById('selectionInfo');
			const saveButton = document.getElementById('saveButton');
			
			info.textContent = count === 1 ? '1 setting selected' : count + ' settings selected';
			saveButton.disabled = count === 0;
		}
		
		function selectAll() {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]');
			checkboxes.forEach(cb => cb.checked = true);
			updateSelectionInfo();
		}
		
		function deselectAll() {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]');
			checkboxes.forEach(cb => cb.checked = false);
			updateSelectionInfo();
		}
		
		function saveSettings() {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
			const selectedSettings = Array.from(checkboxes).map(cb => cb.value);
			
			if (selectedSettings.length === 0) {
				return;
			}
			
			vscode.postMessage({
				command: 'saveSettings',
				settings: selectedSettings
			});
		}
		
		// Initialize selection info on load
		updateSelectionInfo();
		
		// Allow clicking on the setting item to toggle checkbox
		document.querySelectorAll('.setting-item').forEach(item => {
			item.addEventListener('click', (e) => {
				if (e.target.tagName !== 'INPUT') {
					const checkbox = item.querySelector('input[type="checkbox"]');
					checkbox.checked = !checkbox.checked;
					updateSelectionInfo();
				}
			});
		});
		
		// Update selection info when checkboxes change
		document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
			cb.addEventListener('change', updateSelectionInfo);
		});
		
		// Search functionality
		const searchInput = document.getElementById('searchInput');
		searchInput.addEventListener('input', (e) => {
			const searchTerm = e.target.value.toLowerCase();
			const settingItems = document.querySelectorAll('.setting-item');
			
			settingItems.forEach(item => {
				const label = item.querySelector('label');
				const settingName = label.textContent.toLowerCase();
				
				if (settingName.includes(searchTerm)) {
					item.style.display = 'flex';
				} else {
					item.style.display = 'none';
				}
			});
		});
		
		// Focus search input on load
		searchInput.focus();
	</script>
</body>
</html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}

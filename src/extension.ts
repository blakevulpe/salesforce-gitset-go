// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { showCustomSettingsCommand } from './commands/showCustomSettings';
import { retrieveCustomSettingsDataCommand } from './commands/retrieveCustomSettingsData';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "salesforce-gitset-go" is now active!');

	// Register the helloWorld command
	const helloWorldDisposable = vscode.commands.registerCommand('salesforce-gitset-go.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Salesforce GitSet Go!');
	});

	context.subscriptions.push(helloWorldDisposable);

	// Register the showCustomSettings command
	const showCustomSettingsDisposable = vscode.commands.registerCommand(
		'salesforce-gitset-go.showCustomSettings',
		() => showCustomSettingsCommand(context)
	);

	context.subscriptions.push(showCustomSettingsDisposable);

	// Register the retrieveCustomSettingsData command
	const retrieveCustomSettingsDataDisposable = vscode.commands.registerCommand(
		'salesforce-gitset-go.retrieveCustomSettingsData',
		retrieveCustomSettingsDataCommand
	);

	context.subscriptions.push(retrieveCustomSettingsDataDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

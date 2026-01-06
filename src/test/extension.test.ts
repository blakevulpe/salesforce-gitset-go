import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { readCustomSettingsSelection, writeCustomSettingsSelection } from '../services/yamlService';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('yamlService round-trips record selection', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			// Skip in environments without a workspace
			return;
		}

		const tmpUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.test-custom-settings.yaml');
		try {
			writeCustomSettingsSelection(tmpUri.fsPath, {
				CustomSettingsDataKeys: ['MySetting__c'],
				CustomSettingsRecordNames: { MySetting__c: ['MyRecordName'] }
			});

			const readBack = readCustomSettingsSelection(tmpUri.fsPath);
			assert.deepStrictEqual(readBack.CustomSettingsDataKeys, ['MySetting__c']);
			assert.deepStrictEqual(readBack.CustomSettingsRecordNames, { MySetting__c: ['MyRecordName'] });
		} finally {
			// best-effort cleanup
			try {
				await vscode.workspace.fs.delete(tmpUri);
			} catch {
				// ignore
			}
		}
	});
});
